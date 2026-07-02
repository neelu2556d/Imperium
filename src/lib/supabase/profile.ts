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

export interface ProfileBasics {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Persists the "About you" onboarding answers, upserting the single profile
 * row for the current user. Height/weight are always stored in metric no
 * matter which unit the user typed in — the UI converts before calling this.
 */
export async function saveProfileBasics(basics: ProfileBasics): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      name: basics.name,
      age: basics.age,
      height_cm: basics.heightCm,
      weight_kg: basics.weightKg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
