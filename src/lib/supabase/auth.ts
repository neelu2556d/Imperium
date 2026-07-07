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
  if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
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

/** Signs in with email + password. Throws an AuthFieldError on failure. */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw mapAuthError(error.message);
  }
}

/**
 * Decides where to send a user right after signing in. Returns `/train` when
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

  return allDone ? "/train" : "/welcome";
}
