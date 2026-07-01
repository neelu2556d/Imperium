import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Ensures the browser has a Supabase session, signing in anonymously if
 * needed. Anonymous users get a real `auth.uid()` so onboarding progress
 * (and later, other user data) can be persisted before real auth exists.
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
