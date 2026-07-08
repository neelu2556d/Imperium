import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import { reportQueryError } from "@/lib/toast";

/** Shared toast copy so a burst of failed vitals reads collapses into one pill. */
const VITALS_READ_ERROR = "Couldn't load your vitals.";

/**
 * Data layer for the /vitals tab (sleep, water, body weight, progress photos).
 * Like the dashboard layer it is defensive on reads — a brand-new user has no
 * rows, and body_weight_logs / progress_photos only became user-scoped in
 * migration 0013 — so reads swallow errors and return empty shapes. Writes DO
 * surface errors so the UI can show a retry rather than silently losing a log.
 *
 * Note on units: water is stored in LITRES (`amount_liters` / `goal_liters`),
 * matching the schema; the quick-add buttons convert their ml labels to litres.
 * Sleep/water goals live on the log rows themselves (there is no goals table),
 * so the "current goal" is the most recent row's value and editing the goal
 * rewrites it across the user's existing rows.
 */

export const DEFAULT_SLEEP_GOAL = 7.15;
export const DEFAULT_WATER_GOAL = 3.5;

/** Local YYYY-MM-DD (matches how log_date is stored). */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local YYYY-MM-DD `days` before today. */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localISODate(d);
}

/* ============================ SLEEP ============================ */

export interface SleepBar {
  date: string;
  hours: number | null;
}

export interface SleepState {
  /** Today's logged hours, or null if not logged yet. */
  today: number | null;
  /** Current goal — latest row's goal_hours, else the default. */
  goal: number;
  /** The last 7 calendar days (oldest → newest), gaps as null. */
  week: SleepBar[];
}

export async function fetchSleep(): Promise<SleepState> {
  const week = buildWeekWindow();
  const empty: SleepState = { today: null, goal: DEFAULT_SLEEP_GOAL, week };
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("hours, goal_hours, log_date")
      .eq("user_id", userId)
      .gte("log_date", daysAgoISO(30))
      .order("log_date", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return empty;

    const byDate = new Map<string, number>();
    for (const r of rows) byDate.set(String(r.log_date), Number(r.hours) || 0);

    const today = localISODate();
    const latest = rows[rows.length - 1];
    return {
      today: byDate.has(today) ? byDate.get(today)! : null,
      goal: Number(latest.goal_hours) || DEFAULT_SLEEP_GOAL,
      week: week.map((b) => ({
        date: b.date,
        hours: byDate.has(b.date) ? byDate.get(b.date)! : null,
      })),
    };
  } catch {
    reportQueryError(VITALS_READ_ERROR);
    return empty;
  }
}

/** The last 7 calendar days as empty bars (oldest → newest). */
function buildWeekWindow(): SleepBar[] {
  const out: SleepBar[] = [];
  for (let i = 6; i >= 0; i--) out.push({ date: daysAgoISO(i), hours: null });
  return out;
}

/** Logs (replaces) today's sleep, carrying the current goal onto the row. */
export async function logSleep(hours: number, goal: number): Promise<void> {
  const userId = await ensureAnonymousSession();
  const date = localISODate();
  const { error: delErr } = await supabase
    .from("sleep_logs")
    .delete()
    .eq("user_id", userId)
    .eq("log_date", date);
  if (delErr) throw delErr;

  const { error } = await supabase.from("sleep_logs").insert({
    user_id: userId,
    log_date: date,
    hours,
    goal_hours: goal,
  });
  if (error) throw error;
}

/** Rewrites goal_hours across the user's sleep rows so the goal sticks. */
export async function saveSleepGoal(goal: number): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("sleep_logs")
    .update({ goal_hours: goal })
    .eq("user_id", userId);
  if (error) throw error;
}

/* ============================ WATER ============================ */

export interface WaterState {
  /** Today's total, in litres. */
  today: number;
  /** Current goal in litres — latest row's goal_liters, else the default. */
  goal: number;
}

export async function fetchWater(): Promise<WaterState> {
  const empty: WaterState = { today: 0, goal: DEFAULT_WATER_GOAL };
  try {
    const userId = await ensureAnonymousSession();

    const [todayRes, goalRes] = await Promise.all([
      supabase
        .from("water_logs")
        .select("amount_liters")
        .eq("user_id", userId)
        .eq("log_date", localISODate()),
      supabase
        .from("water_logs")
        .select("goal_liters")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(1),
    ]);
    if (todayRes.error) throw todayRes.error;
    if (goalRes.error) throw goalRes.error;

    const today = (todayRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.amount_liters) || 0),
      0
    );
    const goal = goalRes.data?.[0]
      ? Number(goalRes.data[0].goal_liters) || DEFAULT_WATER_GOAL
      : DEFAULT_WATER_GOAL;
    return { today, goal };
  } catch {
    reportQueryError(VITALS_READ_ERROR);
    return empty;
  }
}

/** Adds one water entry (litres) to today's total. */
export async function addWater(liters: number, goal: number): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase.from("water_logs").insert({
    user_id: userId,
    log_date: localISODate(),
    amount_liters: liters,
    goal_liters: goal,
  });
  if (error) throw error;
}

/** Rewrites goal_liters across the user's water rows so the goal sticks. */
export async function saveWaterGoal(goal: number): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("water_logs")
    .update({ goal_liters: goal })
    .eq("user_id", userId);
  if (error) throw error;
}

/* ========================= BODY WEIGHT ========================= */

export interface WeightPoint {
  date: string;
  weight: number;
}

export async function fetchBodyWeights(): Promise<WeightPoint[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("body_weight_logs")
      .select("log_date, weight")
      .eq("user_id", userId)
      .order("log_date", { ascending: true });
    if (error) throw error;

    // One point per day (latest write for a day wins, since rows are date-asc).
    const byDate = new Map<string, number>();
    for (const r of data ?? []) {
      const w = Number(r.weight);
      if (Number.isFinite(w)) byDate.set(String(r.log_date), w);
    }
    return [...byDate.entries()].map(([date, weight]) => ({ date, weight }));
  } catch {
    reportQueryError(VITALS_READ_ERROR);
    return [];
  }
}

/** Logs (replaces) today's body weight. Stored in kg. */
export async function logBodyWeight(weightKg: number): Promise<void> {
  const userId = await ensureAnonymousSession();
  const date = localISODate();
  const { error: delErr } = await supabase
    .from("body_weight_logs")
    .delete()
    .eq("user_id", userId)
    .eq("log_date", date);
  if (delErr) throw delErr;

  const { error } = await supabase.from("body_weight_logs").insert({
    user_id: userId,
    log_date: date,
    weight: weightKg,
  });
  if (error) throw error;
}

/* ======================= PROGRESS PHOTOS ======================= */

export interface ProgressPhoto {
  id: string;
  date: string;
  url: string;
  notes: string | null;
}

export async function fetchPhotos(): Promise<ProgressPhoto[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("progress_photos")
      .select("id, log_date, image_url, notes")
      .eq("user_id", userId)
      .order("log_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      date: String(r.log_date),
      url: String(r.image_url),
      notes: (r.notes as string | null) ?? null,
    }));
  } catch {
    reportQueryError(VITALS_READ_ERROR);
    return [];
  }
}

const PHOTO_BUCKET = "progress-photos";

/**
 * Uploads a check-in photo to Storage under `<user_id>/…` (the prefix the RLS
 * policy keys off), then records its public URL in progress_photos.
 */
export async function addPhoto(
  file: File,
  notes?: string
): Promise<ProgressPhoto> {
  const userId = await ensureAnonymousSession();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  // Unique-ish path without Math.random: date + high-res clock + size.
  const stamp = `${Date.now()}-${Math.round(performance.now())}-${file.size}`;
  const path = `${userId}/${stamp}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;
  const date = localISODate();

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({
      user_id: userId,
      log_date: date,
      image_url: url,
      notes: notes?.trim() || null,
    })
    .select("id, log_date, image_url, notes")
    .single();
  if (error) throw error;

  return {
    id: String(data.id),
    date: String(data.log_date),
    url: String(data.image_url),
    notes: (data.notes as string | null) ?? null,
  };
}
