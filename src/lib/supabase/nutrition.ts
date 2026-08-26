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

/**
 * True when a Supabase/Postgres error means the `_g`-suffixed macro columns
 * don't exist (the original schema created bare protein/fat/carbs; migration
 * 0019 renames them). Lets reads/writes fall back to the legacy column names.
 */
function isMissingGColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "42703" ||
    e.code === "PGRST204" ||
    (typeof e.message === "string" && /_g\b/.test(e.message) &&
      /column|does not exist|schema cache/i.test(e.message))
  );
}

/** Loads the user's saved nutrition goals, or null if they haven't set any. */
export async function fetchNutritionGoals(): Promise<NutritionGoals | null> {
  const userId = await ensureAnonymousSession();

  const run = (columns: string) =>
    supabase
      .from("nutrition_goals")
      .select(columns)
      .eq("user_id", userId)
      .maybeSingle();

  let { data, error } = await run("calories, protein_g, fat_g, carbs_g");
  if (error && isMissingGColumns(error)) {
    ({ data, error } = await run("calories, protein, fat, carbs"));
  }
  if (error) throw error;
  if (!data) return null;

  const r = data as unknown as Record<string, unknown>;
  return {
    calories: Number(r.calories),
    protein_g: Number(r.protein_g ?? r.protein),
    fat_g: Number(r.fat_g ?? r.fat),
    carbs_g: Number(r.carbs_g ?? r.carbs),
  };
}

/** Upserts the user's daily nutrition goals (one row per user_id). */
export async function saveNutritionGoals(goals: NutritionGoals): Promise<void> {
  const userId = await ensureAnonymousSession();

  const run = (row: Record<string, unknown>) =>
    supabase
      .from("nutrition_goals")
      .upsert(
        { user_id: userId, updated_at: new Date().toISOString(), ...row },
        { onConflict: "user_id" }
      );

  const { error } = await run({ ...goals });
  if (error && isMissingGColumns(error)) {
    const { error: retryError } = await run({
      calories: goals.calories,
      protein: goals.protein_g,
      fat: goals.fat_g,
      carbs: goals.carbs_g,
    });
    if (retryError) throw retryError;
    return;
  }
  if (error) throw error;
}

/* ============================= FOOD LOGS ============================= */

/**
 * The Fuel tab logs meals into `food_logs`. Note the column names differ from
 * the goals table: rows store bare `protein` / `fat` / `carbs` grams (per
 * migration 0008), whereas `nutrition_goals` uses the `_g` suffix. The types
 * below mirror the food_logs columns.
 */

export type FoodSource = "manual" | "screenshot_import" | "barcode" | "meal_scan";

/** Which meal a logged item belongs to. Rows default to "snacks". */
export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

/** The four meal sections in display order, with their labels. */
export const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
  { type: "snacks", label: "Snacks" },
];

const MEAL_TYPE_SET = new Set<MealType>([
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
]);

/** Narrows an arbitrary DB string to a MealType, defaulting to "snacks". */
function toMealType(v: unknown): MealType {
  return typeof v === "string" && MEAL_TYPE_SET.has(v as MealType)
    ? (v as MealType)
    : "snacks";
}

export interface FoodLog {
  id: string;
  item_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  source: FoodSource;
  meal_type: MealType;
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
 * True when a Supabase/Postgres error is "column meal_type does not exist"
 * (code 42703). Lets the data layer keep working against a DB where the
 * 0015 migration hasn't been applied yet — reads/writes fall back to the
 * pre-meal_type shape and everything lands under "snacks".
 */
function isMissingMealTypeColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "42703" ||
    (typeof e.message === "string" && /meal_type/i.test(e.message) &&
      /column|does not exist|schema cache/i.test(e.message))
  );
}

/**
 * Loads today's logged food items, newest first. Defensive on reads — a
 * brand-new user has no rows — so failures resolve to an empty list rather
 * than blowing up the whole tab. Falls back to a meal_type-less select when
 * the column isn't present yet (pre-0015), defaulting rows to "snacks".
 */
export async function fetchTodayFoodLogs(): Promise<FoodLog[]> {
  try {
    const userId = await ensureAnonymousSession();

    const run = (columns: string) =>
      supabase
        .from("food_logs")
        .select(columns)
        .eq("user_id", userId)
        .eq("log_date", localISODate())
        .order("created_at", { ascending: false });

    let { data, error } = await run(
      "id, item_name, calories, protein, fat, carbs, source, meal_type"
    );
    if (error && isMissingMealTypeColumn(error)) {
      ({ data, error } = await run(
        "id, item_name, calories, protein, fat, carbs, source"
      ));
    }
    if (error) throw error;

    return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      item_name: String(r.item_name),
      calories: num(r.calories),
      protein: num(r.protein),
      fat: num(r.fat),
      carbs: num(r.carbs),
      source: (r.source as FoodSource) ?? "manual",
      meal_type: toMealType(r.meal_type),
    }));
  } catch {
    return [];
  }
}

/**
 * Inserts one or more food items for today into the given meal section. Writes
 * surface errors so the UI can show a retry rather than silently dropping a
 * meal. If the meal_type column isn't present yet (pre-0015), the insert is
 * retried without it so items still save (landing under "snacks" on read).
 */
export async function addFoodLogs(
  entries: FoodEntryInput[],
  source: FoodSource,
  mealType: MealType = "snacks"
): Promise<void> {
  if (entries.length === 0) return;
  const userId = await ensureAnonymousSession();
  const date = localISODate();

  const baseRows = entries.map((e) => ({
    user_id: userId,
    log_date: date,
    item_name: e.item_name.trim() || "Untitled",
    calories: num(e.calories),
    protein: num(e.protein),
    fat: num(e.fat),
    carbs: num(e.carbs),
    source,
  }));

  const { error } = await supabase
    .from("food_logs")
    .insert(baseRows.map((r) => ({ ...r, meal_type: mealType })));

  if (error && isMissingMealTypeColumn(error)) {
    const { error: retryError } = await supabase
      .from("food_logs")
      .insert(baseRows);
    if (retryError) throw retryError;
    return;
  }
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
