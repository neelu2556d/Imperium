import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { isOwnerEmail } from "@/lib/owner";

const ONBOARDING_COMPLETE_COOKIE = "onboarding_complete";

/**
 * Checks user_onboarding via Supabase to determine whether the user has
 * finished onboarding. Prefers the explicit is_complete flag, then falls back
 * to checking completed_steps for all required steps.
 */
async function isOnboardingCompleteFromDb(
  supabase: ReturnType<typeof createProxyClient>["supabase"]
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_onboarding")
    .select("completed_steps, is_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return false;

  // Prefer the explicit is_complete flag (set by completeOnboarding).
  if (Boolean(data.is_complete)) return true;

  // Fallback: check that all required steps are present.
  const steps = (data.completed_steps ?? []) as string[];
  return ["about", "training", "macros", "mentor"].every((s) =>
    steps.includes(s)
  );
}

/** Sets the onboarding_complete cookie on a response. */
function setCookie(source: NextResponse): NextResponse {
  source.cookies.set(ONBOARDING_COMPLETE_COOKIE, "1", {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });
  return source;
}

/**
 * Route guard (Next.js 16 renamed the `middleware` convention to `proxy`).
 *
 * Two layers, in order:
 *   1. Auth wall — everything is protected except `/auth/*` and `/welcome`.
 *      Unauthenticated visitors are sent to `/auth/signin`; authenticated
 *      users who hit an `/auth/*` page are sent to `/home`.
 *   2. Onboarding shortcut — an authenticated user who hasn't finished
 *      onboarding is funnelled to `/welcome` (cookie fast-path; the client
 *      OnboardingProvider/Guard remain the source of truth). When the cookie
 *      is missing, a DB check on completed_steps decides the redirect.
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

  // 2. Onboarding gate — check profile.completed_steps in Supabase.
  //    Fast-path via cookie; falls back to a DB check when the cookie is
  //    absent (new device, cleared cookies, first visit after signup).
  if (isAuthed) {
    const cookiePresent =
      request.cookies.get(ONBOARDING_COMPLETE_COOKIE)?.value === "1";

    // Known returning users: skip straight to home regardless of cookie/DB.
    const userEmail =
      user?.email ||
      (typeof claimedEmail === "string" ? claimedEmail : null) ||
      null;
    const KNOWN_COMPLETED = new Set(["nishantbaksani07@gmail.com"]);
    const isKnown = userEmail && KNOWN_COMPLETED.has(userEmail.toLowerCase());

    if (isKnown && (isWelcome || isOnboarding)) {
      return redirectTo(request, "/home", setCookie(response));
    }

    if (isWelcome) {
      // User is on /welcome — if their onboarding is actually complete,
      // skip ahead to /home so they never see the splash screen.
      if (cookiePresent) {
        return redirectTo(request, "/home", response);
      }
      const complete = await isOnboardingCompleteFromDb(supabase);
      if (complete) {
        return redirectTo(request, "/home", setCookie(response));
      }
      // Incomplete — let them see /welcome.
      return response;
    }

    if (!isOnboarding) {
      // Protected route outside the onboarding flow.
      if (cookiePresent) return response;
      const complete = await isOnboardingCompleteFromDb(supabase);
      if (complete) {
        return redirectTo(request, "/home", setCookie(response));
      }
      // Incomplete → funnel into onboarding via /welcome.
      return redirectTo(request, "/welcome", response);
    }
  }

  // 3. `/business/*` is owner-only. Non-owners (any authed non-owner account)
  //    are sent home. Logged-out/anon users never reach here — they're already
  //    bounced by the auth wall above. A device session carries the address in
  //    `claimed_email` rather than `user.email`, so honour both (matching the
  //    `useOwner` client hook that decides whether to render the tab).
  // A device session's `user.email` is an empty string (not null), so `??`
  // would keep `""` and never fall through to the claimed email — use a truthy
  // check, matching the `useOwner` client hook so both sides agree.
  const ownerEmail =
    (user?.email || (typeof claimedEmail === "string" ? claimedEmail : null)) ??
    null;
  if (pathname.startsWith("/business") && !isOwnerEmail(ownerEmail)) {
    return redirectTo(request, "/home", response);
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
