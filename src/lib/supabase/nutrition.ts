import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

export interface NutritionGoals {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

/** Starting targets shown before the user has saved anything of their own. */
export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  calories: 2200,
  protein_g: 110,
  fat_g: 73,
  carbs_g: 275,
};

/** Loads the user's saved nutrition goals, or null if they haven't set any. */
export async function fetchNutritionGoals(): Promise<NutritionGoals | null> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("nutrition_goals")
    .select("calories, protein_g, fat_g, carbs_g")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    calories: Number(data.calories),
    protein_g: Number(data.protein_g),
    fat_g: Number(data.fat_g),
    carbs_g: Number(data.carbs_g),
  };
}

/** Upserts the user's daily nutrition goals (one row per user_id). */
export async function saveNutritionGoals(goals: NutritionGoals): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("nutrition_goals").upsert(
    {
      user_id: userId,
      ...goals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
