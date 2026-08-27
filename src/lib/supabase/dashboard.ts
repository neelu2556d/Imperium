import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import { fetchTrainingSplit } from "@/lib/supabase/split";
import {
  DEFAULT_NUTRITION_GOALS,
  fetchNutritionGoals,
} from "@/lib/supabase/nutrition";

/**
 * Data layer for the /home dashboard. Every fetch is defensive: the four log
 * tables (set_logs, sleep_logs, water_logs, food_logs) may not be user-scoped
 * yet (migration 0008 adds user_id + RLS), and a brand-new user has no rows at
 * all. So each function swallows errors and returns an empty shape rather than
 * throwing — the cards render their own "no data yet" states off these.
 */

/** Local YYYY-MM-DD for the given date (matches how log_date is stored). */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The user's display name for the greeting: `name`, then `first_name`, else null. */
export async function getDisplayName(): Promise<string | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("profiles")
      .select("name, first_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.name ?? data?.first_name ?? null;
  } catch {
    return null;
  }
}

export interface TodayTrainingDay {
  name: string;
  isRest: boolean;
}

/**
 * Today's entry in the user's weekly split. `day_order` 1..7 maps onto
 * Mon..Sun, so we index by the local weekday (Mon = 0). Null if no split saved.
 */
export async function fetchTodayTrainingDay(): Promise<TodayTrainingDay | null> {
  try {
    const days = await fetchTrainingSplit();
    if (days.length === 0) return null;
    const mondayIndex = (new Date().getDay() + 6) % 7; // 0 = Monday
    const day = days[mondayIndex] ?? days[days.length - 1];
    return { name: day.name, isRest: day.isRest };
  } catch {
    return null;
  }
}

/**
 * Total volume (Σ weight·reps) for each of the last 7 training sessions, oldest
 * → newest, so it can be drawn straight into a sparkline. Empty array = no data.
 */
export async function fetchTrainSparkline(): Promise<number[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("set_logs")
      .select("weight, reps, log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: true });
    if (error) throw error;

    const byDate = new Map<string, number>();
    for (const row of data ?? []) {
      const weight = Number(row.weight) || 0;
      const reps = Number(row.reps) || 0;
      const key = String(row.log_date);
      byDate.set(key, (byDate.get(key) ?? 0) + weight * reps);
    }
    const volumes = [...byDate.keys()].sort().map((k) => byDate.get(k)!);
    return volumes.slice(-7);
  } catch {
    return [];
  }
}

/** Last 7 days of total logged calories, oldest → newest — the Fuel card line. */
export async function fetchFuelSparkline(): Promise<number[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select("calories, logged_date")
      .eq("user_id", userId)
      .order("logged_date", { ascending: true });
    if (error) throw error;

    const byDate = new Map<string, number>();
    for (const row of data ?? []) {
      const key = String(row.logged_date);
      byDate.set(key, (byDate.get(key) ?? 0) + (Number(row.calories) || 0));
    }
    const series = [...byDate.keys()].sort().map((k) => byDate.get(k)!);
    return series.slice(-7);
  } catch {
    return [];
  }
}

export interface SleepData {
  /** Last 7 nights' hours, oldest → newest. */
  series: number[];
  /** Most recent night's hours, or null if none. */
  latest: number | null;
  /** True when the latest night fell short of its goal. */
  belowGoal: boolean;
}

export async function fetchSleepSeries(): Promise<SleepData> {
  const empty: SleepData = { series: [], latest: null, belowGoal: false };
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("hours, goal_hours, log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).slice(-7);
    if (rows.length === 0) return empty;

    const series = rows.map((r) => Number(r.hours) || 0);
    const last = rows[rows.length - 1];
    const latest = Number(last.hours) || 0;
    const goal = Number(last.goal_hours) || 0;
    return { series, latest, belowGoal: goal > 0 && latest < goal };
  } catch {
    return empty;
  }
}

/** Sum of today's logged water in litres, or null if nothing logged. */
export async function fetchWaterToday(): Promise<number | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("water_logs")
      .select("amount_liters")
      .eq("user_id", userId)
      .eq("log_date", localISODate(new Date()));
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data.reduce((sum, r) => sum + (Number(r.amount_liters) || 0), 0);
  } catch {
    return null;
  }
}

export interface FuelData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goalCalories: number;
  /** True when the user has logged at least one item today. */
  hasData: boolean;
}

export async function fetchFuelToday(): Promise<FuelData> {
  const goals = await fetchNutritionGoals().catch(() => null);
  const goalCalories = goals?.calories ?? DEFAULT_NUTRITION_GOALS.calories;
  const empty: FuelData = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    goalCalories,
    hasData: false,
  };

  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("food_logs")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("logged_date", localISODate(new Date()));
    if (error) throw error;
    if (!data || data.length === 0) return empty;

    const totals = data.reduce(
      (acc, r) => ({
        calories: acc.calories + (Number(r.calories) || 0),
        protein: acc.protein + (Number(r.protein_g) || 0),
        carbs: acc.carbs + (Number(r.carbs_g) || 0),
        fat: acc.fat + (Number(r.fat_g) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return { ...totals, goalCalories, hasData: true };
  } catch {
    return empty;
  }
}
