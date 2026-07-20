import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { isOwnerEmail } from "@/lib/owner";

const ONBOARDING_COMPLETE_COOKIE = "onboarding_complete";

/**
 * Route guard (Next.js 16 renamed the `middleware` convention to `proxy`).
 *
 * Two layers, in order:
 *   1. Auth wall — everything is protected except `/auth/*` and `/welcome`.
 *      Unauthenticated visitors are sent to `/auth/signin`; authenticated
 *      users who hit an `/auth/*` page are sent to `/home`.
 *   2. Onboarding shortcut — an authenticated user who hasn't finished
 *      onboarding is funnelled to `/welcome` (cookie fast-path; the client
 *      OnboardingProvider/Guard remain the source of truth).
 *   3. Owner wall — `/business/*` is strictly owner-only. Any signed-in user
 *      who isn't the owner (see `lib/owner.ts`) is bounced to `/home`.
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

  // A "real" account passes the wall, and so does a device session — an
  // anonymous session the email-only sign-in tagged with a claimed email
  // (the fallback used when the Supabase project requires email
  // confirmation; see signInWithEmailOnly). Untagged anonymous sessions
  // (onboarding persistence) still count as logged-out.
  const claimedEmail = (user?.user_metadata as Record<string, unknown> | undefined)
    ?.claimed_email;
  const isAuthed =
    Boolean(user) &&
    (!user?.is_anonymous || typeof claimedEmail === "string");

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");
  const isWelcome = pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isOnboarding = pathname.startsWith("/onboarding");

  // 1a. Signed-in users have no business on the auth screens.
  if (isAuthed && isAuthRoute) {
    return redirectTo(request, "/home", response);
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

  // 3. `/business/*` is owner-only. Non-owners (any authed non-owner account)
  //    are sent home. Logged-out/anon users never reach here — they're already
  //    bounced by the auth wall above. A device session carries the address in
  //    `claimed_email` rather than `user.email`, so honour both (matching the
  //    `useOwner` client hook that decides whether to render the tab).
  const ownerEmail =
    user?.email ?? (typeof claimedEmail === "string" ? claimedEmail : null);
  if (pathname.startsWith("/business") && !isOwnerEmail(ownerEmail)) {
    // TEMP diagnostic — encode why the gate rejected into the redirect URL so
    // it's visible in the address bar. Remove once the bug is resolved.
    const reason = new URLSearchParams({
      gate: "business-denied",
      hasUser: String(Boolean(user)),
      anon: String(user?.is_anonymous ?? "null"),
      email: user?.email ?? "null",
      claimed: typeof claimedEmail === "string" ? claimedEmail : "null",
      resolved: ownerEmail ?? "null",
      envSet: String(Boolean((process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim())),
    });
    console.log("[proxy] /business gate", reason.toString());
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = `?${reason.toString()}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
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
