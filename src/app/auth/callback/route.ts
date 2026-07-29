import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import {
  clearOnboardingCompleteCookie,
} from "@/lib/onboarding/cookie";
import { postSignInDestination } from "@/lib/supabase/auth";

/**
 * OAuth callback handler for Google (and other providers).
 *
 * Supabase redirects here after the user completes the OAuth flow. We exchange
 * the authorisation code for a real Supabase session, then redirect to the
 * post-sign-in destination (onboarding or home).
 *
 * Because `createProxyClient` reads/writes cookies via the SSR cookie store,
 * the refreshed session tokens ride back on the response automatically.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // OAuth providers pass the auth code as ?code=...
  const code = searchParams.get("code");

  // When there's no code, the user likely denied the consent screen — send
  // them back to sign-in without an error (the screen will show as-is).
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  const { supabase, response } = createProxyClient(request);

  // Exchange the OAuth code for a Supabase session. The `next` param tells
  // Supabase where to route inside our app after exchanging; we use the URL
  // the user was trying to reach (or /auth/signin as fallback).
  const nextUrl = new URL(request.url);
  const next = searchParams.get("next") ?? "/auth/signin";

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth callback error:", error.message);
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  // A new OAuth account hasn't onboarded — make sure any stale shortcut
  // cookie from a previous session is cleared.
  clearOnboardingCompleteCookie();

  // Determine the best destination after sign-in.
  const destination = await postSignInDestination();

  // Redirect to the destination, preserving any refreshed auth cookies that
  // `response` carries from the session exchange.
  const redirect = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}
