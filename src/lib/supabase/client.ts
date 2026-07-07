import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client. Uses `@supabase/ssr` so the session lives in
 * cookies rather than localStorage — that's what lets `proxy.ts` read the
 * auth state server-side to gate routes. It's still a singleton, so every
 * `src/lib/supabase/*` module keeps sharing one client as before.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Ensures the browser has a Supabase session, signing in anonymously if
 * needed. Anonymous users get a real `auth.uid()` so onboarding progress
 * (and later, other user data) can be persisted before real auth exists.
 *
 * Note: an anonymous session is NOT treated as "authenticated" by the route
 * guard (see `proxy.ts`), which checks `is_anonymous`. Onboarding can still
 * write data; the guard only lets real accounts past the auth wall.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.session?.user) {
    throw error ?? new Error("Failed to create anonymous Supabase session.");
  }

  return data.session.user.id;
}
