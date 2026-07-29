import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";

/** Cookie name used by the proxy route guard for the onboarding fast-path.
 *  Must match the name in `proxy.ts` and `cookie.ts`. */
const ONBOARDING_COOKIE = "onboarding_complete";

/** Emails of users known to have completed onboarding. */
const KNOWN_COMPLETED = new Set(["nishantbaksani07@gmail.com"]);

/**
 * OAuth callback handler for Google (and other providers).
 *
 * Supabase redirects here after the user completes the OAuth flow. We exchange
 * the authorisation code for a real Supabase session, then redirect to the
 * post-sign-in destination (onboarding or home).
 *
 * Because `createProxyClient` reads/writes cookies via the SSR cookie store,
 * the refreshed session tokens ride back on the response automatically. All
 * operations are server-side — no browser APIs involved.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  const { supabase, response } = createProxyClient(request);

  // Exchange the OAuth code for a real Supabase session.
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth callback error:", error.message);
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  // Determine the best destination using the server-side client.
  const destination = await determineDestination(supabase, response);

  const redirect = NextResponse.redirect(`${origin}${destination}`);

  // Preserve any refreshed auth cookies from the session exchange.
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}

/**
 * Server-side equivalent of `postSignInDestination`. Checks the DB for
 * onboarding completion status and sets/clears the fast-path cookie on the
 * response so the proxy guard doesn't bounce the user.
 */
async function determineDestination(
  supabase: ReturnType<typeof createProxyClient>["supabase"],
  response: ReturnType<typeof createProxyClient>["response"],
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/onboarding/setup";

  // Known completed users skip the DB check.
  if (user.email && KNOWN_COMPLETED.has(user.email.toLowerCase())) {
    response.cookies.set(ONBOARDING_COOKIE, "1", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
    return "/home";
  }

  // Check onboarding state in the DB.
  const { data: onboarding } = await supabase
    .from("user_onboarding")
    .select("is_complete, completed_steps")
    .eq("user_id", user.id)
    .maybeSingle();

  if (onboarding) {
    const allDone =
      Boolean(onboarding.is_complete) ||
      ["about", "training", "macros", "mentor"].every((s) =>
        ((onboarding.completed_steps ?? []) as string[]).includes(s),
      );

    if (allDone) {
      response.cookies.set(ONBOARDING_COOKIE, "1", {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
      return "/home";
    }
  }

  // Try transferring data from an anonymous session (email-only flow).
  if (user.email) {
    try {
      await supabase.rpc("transfer_all_user_data", { p_email: user.email });
    } catch {
      // Non-fatal — the user will just re-do onboarding.
    }

    const { data: retry } = await supabase
      .from("user_onboarding")
      .select("is_complete")
      .eq("user_id", user.id)
      .maybeSingle();

    if (retry?.is_complete) {
      response.cookies.set(ONBOARDING_COOKIE, "1", {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
      return "/home";
    }
  }

  // Not onboarded — clear any stale cookie and send to setup.
  response.cookies.set(ONBOARDING_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return "/onboarding/setup";
}
