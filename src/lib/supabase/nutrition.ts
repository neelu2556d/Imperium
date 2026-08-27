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
 * The Fuel tab logs meals into `food_logs` (rebuilt in migration 0025). Each
 * row now carries the serving the user actually logged (amount + unit + the
 * gram weight it resolves to), the four macros with the `_g` suffix, fiber, an
 * optional brand, and a source/ref pair recording where the food came from.
 */

/** Where a logged food originated. Stored as free text; these are the app's. */
export type FoodSource =
  | "indian"
  | "custom"
  | "usda"
  | "off"
  | "barcode"
  | "meal_scan"
  | "quick_add";

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
export function toMealType(v: unknown): MealType {
  return typeof v === "string" && MEAL_TYPE_SET.has(v as MealType)
    ? (v as MealType)
    : "snacks";
}

export interface FoodLog {
  id: string;
  logged_date: string;
  meal_type: MealType;
  food_source: string;
  food_ref_id: string | null;
  food_name: string;
  brand: string | null;
  serving_amount: number;
  serving_unit: string;
  serving_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

/** A food_logs row to insert (no id/created_at — the DB fills those). */
export interface NewFoodLog {
  logged_date: string;
  meal_type: MealType;
  food_source: string;
  food_ref_id?: string | null;
  food_name: string;
  brand?: string | null;
  serving_amount: number;
  serving_unit: string;
  serving_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

/** The mutable serving/macro fields of an existing entry (diary edit). */
export interface FoodLogPatch {
  serving_amount: number;
  serving_unit: string;
  serving_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

/** Local YYYY-MM-DD, matching how `logged_date` is stored (mirrors vitals). */
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

const SELECT_COLS =
  "id, logged_date, meal_type, food_source, food_ref_id, food_name, brand, " +
  "serving_amount, serving_unit, serving_g, calories, protein_g, fat_g, " +
  "carbs_g, fiber_g";

/** Maps a raw DB row to a typed FoodLog. */
function toFoodLog(r: Record<string, unknown>): FoodLog {
  return {
    id: String(r.id),
    logged_date: String(r.logged_date),
    meal_type: toMealType(r.meal_type),
    food_source: String(r.food_source ?? "quick_add"),
    food_ref_id: r.food_ref_id == null ? null : String(r.food_ref_id),
    food_name: String(r.food_name ?? "Untitled"),
    brand: r.brand == null ? null : String(r.brand),
    serving_amount: num(r.serving_amount),
    serving_unit: String(r.serving_unit ?? "g"),
    serving_g: num(r.serving_g),
    calories: num(r.calories),
    protein_g: num(r.protein_g),
    fat_g: num(r.fat_g),
    carbs_g: num(r.carbs_g),
    fiber_g: num(r.fiber_g),
  };
}

/**
 * Loads a single day's logged food, newest first. Defensive on reads — a
 * brand-new user has no rows — so failures resolve to an empty list rather
 * than blowing up the whole tab.
 */
export async function fetchFoodLogs(
  date: string = localISODate()
): Promise<FoodLog[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .eq("logged_date", date)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toFoodLog);
  } catch {
    return [];
  }
}

/** Loads all logs in an inclusive [start, end] date range (for Progress). */
export async function fetchFoodLogsRange(
  start: string,
  end: string
): Promise<FoodLog[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .gte("logged_date", start)
      .lte("logged_date", end)
      .order("logged_date", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toFoodLog);
  } catch {
    return [];
  }
}

/** Inserts one or more food entries. Surfaces errors so the UI can retry. */
export async function insertFoodLogs(rows: NewFoodLog[]): Promise<void> {
  if (rows.length === 0) return;
  const userId = await ensureAnonymousSession();
  const payload = rows.map((r) => ({
    user_id: userId,
    logged_date: r.logged_date,
    meal_type: r.meal_type,
    food_source: r.food_source,
    food_ref_id: r.food_ref_id ?? null,
    food_name: r.food_name.trim() || "Untitled",
    brand: r.brand ?? null,
    serving_amount: num(r.serving_amount),
    serving_unit: r.serving_unit,
    serving_g: num(r.serving_g),
    calories: num(r.calories),
    protein_g: num(r.protein_g),
    fat_g: num(r.fat_g),
    carbs_g: num(r.carbs_g),
    fiber_g: num(r.fiber_g),
  }));
  const { error } = await supabase.from("food_logs").insert(payload);
  if (error) throw error;
}

/** Updates the serving/macros of an existing entry (diary edit). */
export async function updateFoodLog(
  id: string,
  patch: FoodLogPatch
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("food_logs")
    .update({
      serving_amount: num(patch.serving_amount),
      serving_unit: patch.serving_unit,
      serving_g: num(patch.serving_g),
      calories: num(patch.calories),
      protein_g: num(patch.protein_g),
      fat_g: num(patch.fat_g),
      carbs_g: num(patch.carbs_g),
      fiber_g: num(patch.fiber_g),
    })
    .eq("user_id", userId)
    .eq("id", id);
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

/** A distinct recently-logged food (for the logger's "Recent" list). */
export interface RecentFood {
  food_name: string;
  food_source: string;
  food_ref_id: string | null;
  brand: string | null;
  /** kcal per 100g, back-computed from the last logged serving. */
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  fiber_per_100g: number;
}

/**
 * The user's last `limit` unique foods (by name), newest first — back-computes
 * per-100g values from each row's logged serving so the logger can re-open the
 * serving selector with the food's base nutrition.
 */
export async function fetchRecentFoods(limit = 10): Promise<RecentFood[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    const seen = new Set<string>();
    const out: RecentFood[] = [];
    for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
      const row = toFoodLog(raw);
      const key = row.food_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const g = row.serving_g || 100;
      const per = (v: number) => (g > 0 ? (v / g) * 100 : v);
      out.push({
        food_name: row.food_name,
        food_source: row.food_source,
        food_ref_id: row.food_ref_id,
        brand: row.brand,
        calories_per_100g: per(row.calories),
        protein_per_100g: per(row.protein_g),
        fat_per_100g: per(row.fat_g),
        carbs_per_100g: per(row.carbs_g),
        fiber_per_100g: per(row.fiber_g),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
