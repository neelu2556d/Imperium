import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";

const ONBOARDING_COMPLETE_COOKIE = "onboarding_complete";

/**
 * Route guard (Next.js 16 renamed the `middleware` convention to `proxy`).
 *
 * Two layers, in order:
 *   1. Auth wall — everything is protected except `/auth/*` and `/welcome`.
 *      Unauthenticated visitors are sent to `/auth/signin`; authenticated
 *      users who hit an `/auth/*` page are sent to `/train`.
 *   2. Onboarding shortcut — an authenticated user who hasn't finished
 *      onboarding is funnelled to `/welcome` (cookie fast-path; the client
 *      OnboardingProvider/Guard remain the source of truth).
 *
 * "Authenticated" means a *real* account — anonymous Supabase sessions (used to
 * persist onboarding progress) count as logged-out, so they still hit the wall.
 * Auth is read from cookies via `@supabase/ssr`; `getUser()` also refreshes the
 * session and those refreshed cookies ride back on the response we return.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createProxyClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user) && !user?.is_anonymous;

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");
  const isWelcome = pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isOnboarding = pathname.startsWith("/onboarding");

  // 1a. Signed-in users have no business on the auth screens.
  if (isAuthed && isAuthRoute) {
    return redirectTo(request, "/train", response);
  }

  // 1b. `/auth/*` and `/welcome` are the only routes open to logged-out users.
  if (!isAuthed && !isAuthRoute && !isWelcome) {
    return redirectTo(request, "/auth/signin", response);
  }

  // 2. Authed but onboarding unfinished → send into onboarding via /welcome.
  //    Skip while already inside the flow to avoid a redirect loop.
  if (isAuthed && !isWelcome && !isOnboarding) {
    const onboarded =
      request.cookies.get(ONBOARDING_COMPLETE_COOKIE)?.value === "1";
    if (!onboarded) {
      return redirectTo(request, "/welcome", response);
    }
  }

  return response;
}

/**
 * Redirects while preserving any auth cookies Supabase refreshed onto
 * `source` — otherwise a token rotation during this request would be lost.
 */
function redirectTo(
  request: NextRequest,
  pathname: string,
  source: NextResponse
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - api routes (they enforce their own auth; must not get HTML redirects)
     * - _next/static, _next/image (framework assets)
     * - metadata + PWA files (favicon, manifest, icon, apple-icon)
     * - any file with an image extension served from /public
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
