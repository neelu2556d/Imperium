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

/* ============================= FOOD LOGS ============================= */

/**
 * The Fuel tab logs meals into `food_logs`. Note the column names differ from
 * the goals table: rows store bare `protein` / `fat` / `carbs` grams (per
 * migration 0008), whereas `nutrition_goals` uses the `_g` suffix. The types
 * below mirror the food_logs columns.
 */

export type FoodSource = "manual" | "screenshot_import";

export interface FoodLog {
  id: string;
  item_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  source: FoodSource;
}

/** The macro payload for a single food item, before it has a row id. */
export interface FoodEntryInput {
  item_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** Local YYYY-MM-DD, matching how `log_date` is stored (mirrors vitals). */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Loads today's logged food items, newest first. Defensive on reads — a
 * brand-new user has no rows — so failures resolve to an empty list rather
 * than blowing up the whole tab.
 */
export async function fetchTodayFoodLogs(): Promise<FoodLog[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select("id, item_name, calories, protein, fat, carbs, source")
      .eq("user_id", userId)
      .eq("log_date", localISODate())
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: String(r.id),
      item_name: String(r.item_name),
      calories: num(r.calories),
      protein: num(r.protein),
      fat: num(r.fat),
      carbs: num(r.carbs),
      source: (r.source as FoodSource) ?? "manual",
    }));
  } catch {
    return [];
  }
}

/**
 * Inserts one or more food items for today. Writes surface errors so the UI
 * can show a retry rather than silently dropping a meal.
 */
export async function addFoodLogs(
  entries: FoodEntryInput[],
  source: FoodSource
): Promise<void> {
  if (entries.length === 0) return;
  const userId = await ensureAnonymousSession();
  const date = localISODate();

  const rows = entries.map((e) => ({
    user_id: userId,
    log_date: date,
    item_name: e.item_name.trim() || "Untitled",
    calories: num(e.calories),
    protein: num(e.protein),
    fat: num(e.fat),
    carbs: num(e.carbs),
    source,
  }));

  const { error } = await supabase.from("food_logs").insert(rows);
  if (error) throw error;
}

/** Deletes a single logged food item by id. */
export async function deleteFoodLog(id: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("food_logs")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
