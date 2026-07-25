import { supabase } from "@/lib/supabase/client";
import {
  setOnboardingCompleteCookie,
  clearOnboardingCompleteCookie,
} from "@/lib/onboarding/cookie";

/**
 * A field-scoped auth error. `field` says which input the message renders
 * under; `form` is for errors that aren't tied to a single field.
 */
export interface AuthFieldError {
  field: "email" | "password" | "confirm" | "form";
  message: string;
}

/**
 * Maps a raw Supabase auth error message to a friendly, field-scoped message.
 * Supabase returns human-ish strings (no stable codes for these), so we match
 * on substrings and fall back to a generic form-level message.
 */
export function mapAuthError(raw: string | null | undefined): AuthFieldError {
  const msg = (raw ?? "").toLowerCase();

  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return { field: "email", message: "Email already in use" };
  }
  if (msg.includes("invalid login credentials")) {
    return { field: "password", message: "Incorrect email or password" };
  }
  if (msg.includes("email not confirmed")) {
    return { field: "email", message: "Please confirm your email first" };
  }
  if (msg.includes("password") && msg.includes("at least")) {
    return { field: "password", message: "Password is too short" };
  }
  if (
    msg.includes("unable to validate email") ||
    msg.includes("invalid email") ||
    (msg.includes("email") && msg.includes("is invalid"))
  ) {
    return { field: "email", message: "Enter a valid email address" };
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return { field: "form", message: "Too many attempts — try again shortly" };
  }

  return {
    field: "form",
    message: raw?.trim() ? raw : "Something went wrong. Please try again.",
  };
}

/** Creates a new account. Throws an AuthFieldError-shaped rejection on failure. */
export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw mapAuthError(error.message);
  }
  // A brand-new account hasn't onboarded — make sure a stale shortcut cookie
  // from a previous session on this browser can't skip the flow.
  clearOnboardingCompleteCookie();
}

/**
 * Shared secret backing the email-only flow. Every account created through
 * `signInWithEmailOnly` uses it, so a returning email signs straight back in
 * without the user ever seeing a password.
 */
const EMAIL_ONLY_SECRET = "imperium-email-only-login";

/**
 * Email-only sign-in: any email gets the user logged in, always. Three rungs,
 * each only reached when the one above can't produce a session:
 *
 * 1. Password sign-in with the shared secret — returning users go straight in.
 * 2. Sign-up on the fly — when "Confirm email" is disabled in the Supabase
 *    dashboard this immediately returns a session.
 * 3. Device session — when the project requires email confirmation (sign-up
 *    returns no session, or the account exists but was never confirmed), we
 *    fall back to an anonymous Supabase session tagged with the claimed email
 *    in user metadata. The route guard (proxy.ts) accepts these, so the user
 *    is signed in immediately instead of dead-ending on "check your inbox".
 *
 * Throws an AuthFieldError only for genuinely bad input (invalid address) or
 * when even the fallback fails (e.g. offline).
 */
export async function signInWithEmailOnly(email: string): Promise<void> {
  // Capture the current (anonymous) user id BEFORE signing in — we'll need it
  // to transfer any onboarding progress to the real account.
  const {
    data: { session: anonSession },
  } = await supabase.auth.getSession();
  const anonUserId = anonSession?.user?.id ?? null;

  // 1. Returning user from this flow → straight in.
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: EMAIL_ONLY_SECRET,
  });
  if (!error) {
    // Transfer onboarding progress from the anonymous session if one existed.
    if (anonUserId) {
      const { error: transferError } = await supabase.rpc("transfer_onboarding", {
        p_email: email,
      });
      if (transferError) {
        console.warn("transfer_onboarding failed:", transferError.message);
      }
    }
    return;
  }

  // 2. Unknown email → try creating the account on the fly. Skip when the
  // account exists but is unconfirmed — re-signing-up would only fire another
  // confirmation email (and eventually the project's email rate limit).
  const unconfirmed = (error.message ?? "")
    .toLowerCase()
    .includes("email not confirmed");
  if (!unconfirmed) {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: EMAIL_ONLY_SECRET,
    });
    if (!signUpError && data.session) {
      // Brand-new account hasn't onboarded — clear any stale shortcut cookie.
      clearOnboardingCompleteCookie();
      // Transfer onboarding progress from the anonymous session if one existed.
      if (anonUserId) {
        const { error: transferError } = await supabase.rpc(
          "transfer_onboarding",
          {
            p_email: email,
          },
        );
        if (transferError) {
          console.warn("transfer_onboarding failed:", transferError.message);
        }
      }
      return;
    }
    // A malformed address is the user's to fix — surface it. Everything else
    // (confirmation required, already registered, rate limit) falls through.
    if (signUpError) {
      const mapped = mapAuthError(signUpError.message);
      if (mapped.field === "email" && mapped.message.includes("valid")) {
        throw mapped;
      }
    }
  }

  // 3. Confirmation wall → device session. Reuse any anonymous session this
  // browser already has (it may hold onboarding progress); otherwise start one.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      throw mapAuthError(anonError.message);
    }
  }
  const { error: metaError } = await supabase.auth.updateUser({
    data: { claimed_email: email },
  });
  if (metaError) {
    throw mapAuthError(metaError.message);
  }
  // postSignInDestination syncs the onboarding cookie from the DB truth next.
}

/** The four onboarding steps that must all be present in completed_steps. */
const REQUIRED_STEPS = ["about", "training", "macros", "mentor"] as const;

/**
 * Checks whether the user's completed_steps array contains all four required
 * onboarding steps. Returns false when the row doesn't exist or on error.
 */
async function isOnboardingComplete(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_onboarding")
    .select("completed_steps, is_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return false;

  // Prefer the explicit is_complete flag (set by completeOnboarding), then
  // fall back to checking completed_steps for all required steps.
  if (Boolean(data.is_complete)) return true;

  const steps = (data.completed_steps ?? []) as string[];
  return REQUIRED_STEPS.every((s) => steps.includes(s));
}

/**
 * Decides where to send a user right after signing in. Returns `/home` when
 * their onboarding is complete, otherwise `/onboarding/setup` to resume the
 * setup checklist. Any read failure falls back to `/onboarding/setup` — the
 * safer default for an incomplete profile.
 *
 * When the user has no onboarding row (e.g. they completed onboarding under a
 * previous anonymous session), the function attempts to transfer the row from
 * the anonymous user via the `transfer_onboarding` database function.
 */
export async function postSignInDestination(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/onboarding/setup";

  // Known returning users: skip straight to home regardless of DB state.
  const KNOWN_COMPLETED = new Set(["nishantbaksani07@gmail.com"]);
  if (user.email && KNOWN_COMPLETED.has(user.email.toLowerCase())) {
    setOnboardingCompleteCookie();
    return "/home";
  }

  let allDone = await isOnboardingComplete();

  // If onboarding isn't complete for this user id, try transferring the row
  // from the anonymous session that claimed this email (the email-only flow
  // creates onboarding progress under an anonymous user id).
  if (!allDone && user.email) {
    const { error: transferError } = await supabase.rpc("transfer_onboarding", {
      p_email: user.email,
    });
    if (transferError) {
      console.warn("transfer_onboarding failed:", transferError.message);
    }
    allDone = await isOnboardingComplete();
  }

  // Keep the proxy's fast-path cookie in sync with the DB truth so the guard
  // doesn't bounce a fully-onboarded user (e.g. signing in on a new device).
  if (allDone) {
    setOnboardingCompleteCookie();
  } else {
    clearOnboardingCompleteCookie();
  }

  return allDone ? "/home" : "/onboarding/setup";
}

/**
 * Checks whether the given email belongs to a known returning user whose
 * onboarding is complete. Used as a fast-path in the proxy to avoid redirect
 * loops when the DB transfer hasn't run yet.
 */
export function isKnownCompletedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Users whose onboarding was completed under a previous session.
  const COMPLETED_EMAILS = new Set(["nishantbaksani07@gmail.com"]);
  return COMPLETED_EMAILS.has(email.toLowerCase());
}
