import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ONBOARDING_COMPLETE_COOKIE = "onboarding_complete";

/**
 * Fast, cookie-based redirect into onboarding for anyone who hasn't
 * completed it. The cookie is only a performance shortcut — Supabase
 * (checked client-side by OnboardingProvider/OnboardingStepGuard) remains
 * the source of truth and re-validates on every onboarding route.
 */
export function proxy(request: NextRequest) {
  const hasCompletedOnboarding =
    request.cookies.get(ONBOARDING_COMPLETE_COOKIE)?.value === "1";

  if (!hasCompletedOnboarding) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!welcome|onboarding|api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
