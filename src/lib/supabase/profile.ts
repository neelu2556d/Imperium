import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

/**
 * Loads the current user's first name. Returns null for brand-new users who
 * haven't set a profile row yet, so callers can fall back to a generic
 * greeting.
 */
export async function getFirstName(): Promise<string | null> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data?.first_name ?? null;
}
