import { supabase } from "@/lib/supabase/client";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
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
  // 1. Returning user from this flow → straight in.
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: EMAIL_ONLY_SECRET,
  });
  if (!error) return;

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

/**
 * Decides where to send a user right after signing in. Returns `/home` when
 * their onboarding row has every step in `completed_steps`, otherwise
 * `/welcome` to (re)start onboarding. Any read failure falls back to
 * `/welcome` — the safer default for an incomplete profile.
 */
export async function postSignInDestination(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/welcome";

  const { data, error } = await supabase
    .from("user_onboarding")
    .select("completed_steps")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return "/welcome";

  const completed = new Set((data.completed_steps ?? []) as string[]);
  const allDone = ONBOARDING_STEPS.every((step) => completed.has(step));

  // Keep the proxy's fast-path cookie in sync with the DB truth so the guard
  // doesn't bounce a fully-onboarded user (e.g. signing in on a new device)
  // back through /welcome.
  if (allDone) {
    setOnboardingCompleteCookie();
  } else {
    clearOnboardingCompleteCookie();
  }

  return allDone ? "/home" : "/welcome";
}
