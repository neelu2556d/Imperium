import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Cookie name used by the proxy route guard for the onboarding fast-path. */
const ONBOARDING_COOKIE = "onboarding_complete";

/**
 * Cookie option fields we restamp onto the final redirect. Kept local because
 * Next 16 doesn't re-export the `ResponseCookie` type from `next/server` — this
 * is the subset of its signature the callback actually writes.
 */
interface CookieOptions {
  path?: string;
  maxAge?: number;
  sameSite?: "lax" | "strict" | "none";
}

/** Emails of users known to have completed onboarding. */
const KNOWN_COMPLETED = new Set(["nishantbaksani07@gmail.com"]);

/**
 * OAuth callback handler for Google (and other providers).
 *
 * Supabase redirects here after the user completes the OAuth flow. We exchange
 * the authorisation code for a real Supabase session, then redirect to the
 * post-sign-in destination (onboarding or home).
 *
 * Unlike `createProxyClient` (which is designed for middleware/proxy.ts), this
 * handler creates `createServerClient` directly using the Route Handler cookie
 * pattern: `request.cookies.getAll()` for reads and a local response for writes.
 * This ensures the PKCE code verifier cookie and the exchanged session cookies
 * are handled correctly in the Route Handler context.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  if (!code) {
    console.error("OAuth callback: no code in URL params");
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  // We'll collect cookies that need to be set onto the final redirect response.
  // This avoids relying on NextResponse.next() (designed for middleware) inside
  // a Route Handler.
  const pendingCookies: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            // Replace any pending cookie with the same name (last write wins).
            const idx = pendingCookies.findIndex((c) => c.name === name);
            const entry = {
              name,
              value,
              options: options as CookieOptions | undefined,
            };
            if (idx >= 0) {
              pendingCookies[idx] = entry;
            } else {
              pendingCookies.push(entry);
            }
          }
        },
      },
    }
  );

  console.log("OAuth callback: exchanging code for session…");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth callback: exchangeCodeForSession failed:", error.message);
    // Failed — redirect back to sign-in.
    return NextResponse.redirect(`${origin}/auth/signin`);
  }
  console.log("OAuth callback: session exchange succeeded.");

  // Determine the best destination using the server-side client.
  const destination = await determineDestination(supabase, pendingCookies);
  console.log("OAuth callback: destination =", destination);

  // Build the final redirect and stamp all accumulated cookies onto it.
  const redirect = NextResponse.redirect(`${origin}${destination}`);
  for (const { name, value, options } of pendingCookies) {
    redirect.cookies.set(name, value, options);
  }

  return redirect;
}

/**
 * Server-side equivalent of `postSignInDestination`. Checks the DB for
 * onboarding completion status and pushes the fast-path cookie into
 * `pendingCookies` so the proxy guard doesn't bounce the user.
 */
async function determineDestination(
  supabase: ReturnType<typeof createServerClient>,
  pendingCookies: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("OAuth callback: no user after session exchange, sending to onboarding");
    return "/onboarding/setup";
  }

  // Known completed users skip the DB check.
  if (user.email && KNOWN_COMPLETED.has(user.email.toLowerCase())) {
    pendingCookies.push({
      name: ONBOARDING_COOKIE,
      value: "1",
      options: { path: "/", maxAge: 31536000, sameSite: "lax" },
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
      pendingCookies.push({
        name: ONBOARDING_COOKIE,
        value: "1",
        options: { path: "/", maxAge: 31536000, sameSite: "lax" },
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
      pendingCookies.push({
        name: ONBOARDING_COOKIE,
        value: "1",
        options: { path: "/", maxAge: 31536000, sameSite: "lax" },
      });
      return "/home";
    }
  }

  // Not onboarded — clear any stale cookie and send to setup.
  pendingCookies.push({
    name: ONBOARDING_COOKIE,
    value: "",
    options: { path: "/", maxAge: 0 },
  });
  return "/onboarding/setup";
}
