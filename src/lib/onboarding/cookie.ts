const ONBOARDING_COMPLETE_COOKIE = "onboarding_complete";

/** Mirrors Supabase's `is_complete` flag so proxy.ts can redirect fast, without a DB round trip. */
export function setOnboardingCompleteCookie() {
  document.cookie = `${ONBOARDING_COMPLETE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

export function clearOnboardingCompleteCookie() {
  document.cookie = `${ONBOARDING_COMPLETE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
