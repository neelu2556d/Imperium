import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import { reportQueryError } from "@/lib/toast";

/**
 * Data layer for the /train dashboard. Like the /home layer, every fetch is
 * defensive: a brand-new user has no split and no logged sets, and the log
 * tables may be sparse, so each function swallows its errors and returns an
 * empty shape rather than throwing. The dashboard renders its own empty states
 * off these.
 */

/** One day in the user's split, with how many exercises are picked for it. */
export interface TrainSplitDay {
  id: string;
  name: string;
  dayOrder: number;
  isRest: boolean;
  exerciseCount: number;
}

/** The heaviest single set of a session, for the "top lift" line. */
export interface TopLift {
  name: string;
  weight: number;
  reps: number;
}

/** Compact summary of the most recently logged session. */
export interface LastSession {
  /** Local YYYY-MM-DD of the session (matches how log_date is stored). */
  date: string;
  /** The split day the session's exercises belong to, if resolvable. */
  dayName: string | null;
  /** Number of sets logged that day. */
  totalSets: number;
  topLift: TopLift | null;
}

/**
 * The date of the user's FIRST ever logged set — the anchor the split cycles
 * from, so "today's" training day is `daysSince(firstSession) mod splitLength`.
 * Returns null when nothing has been logged yet; the dashboard treats that as
 * "default to day 1". Parsed from the local YYYY-MM-DD `log_date` so the day
 * doesn't shift under UTC.
 */
export async function fetchFirstSessionDate(): Promise<Date | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("set_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: true })
      .limit(1);
    if (error) throw error;

    const iso = data?.[0]?.log_date as string | undefined;
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  } catch {
    reportQueryError("Couldn't load your training history.");
    return null;
  }
}

/** Exercise counts keyed by training_split_id, tallied client-side. */
async function countExercisesByDay(
  splitIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (splitIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("day_exercises")
    .select("training_split_id")
    .in("training_split_id", splitIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const id = row.training_split_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** The user's split, ordered Mon → Sun, each with its exercise count. */
export async function fetchSplitDays(): Promise<TrainSplitDay[]> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("training_split")
      .select("id, name, day_order, is_rest_day")
      .eq("user_id", userId)
      .order("day_order", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const counts = await countExercisesByDay(rows.map((r) => r.id as string));

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      dayOrder: r.day_order as number,
      isRest: Boolean(r.is_rest_day),
      exerciseCount: counts[r.id as string] ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Maps a set of exercise ids to their display names. Decorative (drives the
 * top-lift label only), so it swallows its own errors and returns whatever it
 * resolved rather than throwing — a failed name lookup must not erase the whole
 * last-session summary.
 */
async function resolveExerciseNames(
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (exerciseIds.length === 0) return names;

  try {
    const { data, error } = await supabase
      .from("exercises")
      .select("id, name")
      .in("id", exerciseIds);
    if (error) throw error;

    for (const row of data ?? []) {
      names.set(row.id as string, row.name as string);
    }
  } catch {
    // leave `names` as whatever we had (empty) — the caller falls back to "Lift".
  }
  return names;
}

/**
 * The split day a session belongs to, inferred from any of its exercises via
 * day_exercises → training_split. Null when the exercises aren't mapped to a
 * day (e.g. logged ad-hoc, or picks cleared since).
 *
 * This is a *decorative* lookup — it only supplies the day-name label. It must
 * never be able to sink the whole "last session" summary, so it swallows its own
 * errors (a stale PostgREST embed relationship, say) and returns null rather
 * than throwing. Before this was fatal: a logged session simply vanished from
 * the dashboard when the embed failed.
 */
async function resolveDayName(
  userId: string,
  exerciseIds: string[]
): Promise<string | null> {
  if (exerciseIds.length === 0) return null;

  try {
    const { data, error } = await supabase
      .from("day_exercises")
      .select("training_split ( name )")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds)
      .limit(1);
    if (error) throw error;

    const split = (data?.[0] as Record<string, unknown> | undefined)
      ?.training_split as { name?: string } | null | undefined;
    return split?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * The most recent logged session: its date, the split day it maps to, how many
 * sets were logged, and the heaviest single set as the headline lift. Null when
 * nothing has been logged yet.
 */
export async function fetchLastSession(): Promise<LastSession | null> {
  try {
    const userId = await ensureAnonymousSession();

    // The newest log_date is the session we summarise.
    const { data: latest, error: latestError } = await supabase
      .from("set_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(1);
    if (latestError) throw latestError;

    const date = latest?.[0]?.log_date as string | undefined;
    if (!date) return null;

    const { data: sets, error: setsError } = await supabase
      .from("set_logs")
      .select("exercise_id, weight, reps")
      .eq("user_id", userId)
      .eq("log_date", date);
    if (setsError) throw setsError;

    const rows = sets ?? [];
    const totalSets = rows.length;

    // Top lift = heaviest set that day, ties broken by reps.
    let heaviest: { exerciseId: string | null; weight: number; reps: number } | null =
      null;
    for (const row of rows) {
      const weight = Number(row.weight) || 0;
      const reps = Number(row.reps) || 0;
      if (
        !heaviest ||
        weight > heaviest.weight ||
        (weight === heaviest.weight && reps > heaviest.reps)
      ) {
        heaviest = { exerciseId: (row.exercise_id as string) ?? null, weight, reps };
      }
    }

    const exerciseIds = [
      ...new Set(rows.map((r) => r.exercise_id as string).filter(Boolean)),
    ];
    const [names, dayName] = await Promise.all([
      resolveExerciseNames(exerciseIds),
      resolveDayName(userId, exerciseIds),
    ]);

    const topLift: TopLift | null =
      heaviest && heaviest.exerciseId
        ? {
            name: names.get(heaviest.exerciseId) ?? "Lift",
            weight: heaviest.weight,
            reps: heaviest.reps,
          }
        : null;

    return { date, dayName, totalSets, topLift };
  } catch {
    // The decorative lookups above can't reach here anymore, so a throw here is
    // a real read failure (the set_logs queries themselves). Surface it instead
    // of silently showing the "no sessions logged yet" empty state, which reads
    // as "your session wasn't saved".
    reportQueryError("Couldn't load your last session.");
    return null;
  }
}

/**
 * Deletes a logged session: every set logged on `date` plus that date's
 * completion marker(s). Returns true on success; failures surface a toast and
 * return false so callers can leave the UI untouched.
 */
export async function deleteSession(date: string): Promise<boolean> {
  try {
    const userId = await ensureAnonymousSession();

    const { error } = await supabase
      .from("set_logs")
      .delete()
      .eq("user_id", userId)
      .eq("log_date", date);
    if (error) throw error;

    const { error: completionError } = await supabase
      .from("session_completions")
      .delete()
      .eq("user_id", userId)
      .eq("completed_date", date);
    if (completionError) throw completionError;

    return true;
  } catch {
    reportQueryError("Couldn't delete that session. Try again.");
    return false;
  }
}

/** One exercise's contribution to a past session, for the history list. */
export interface HistoryExercise {
  exerciseId: string | null;
  name: string;
  /** Number of sets logged for this exercise that session. */
  sets: number;
  /** Heaviest set that session (drives the "top NNkg × R" sub-label). */
  topWeight: number | null;
  topReps: number | null;
}

/** One past training session (all sets sharing a log_date), newest first. */
export interface SessionHistoryEntry {
  /** Local YYYY-MM-DD of the session. */
  date: string;
  dayName: string | null;
  totalSets: number;
  topLift: TopLift | null;
  exercises: HistoryExercise[];
}

/**
 * Maps each exercise id to the split day it belongs to, via day_exercises →
 * training_split. Decorative (drives the per-session day label only), so it
 * swallows its own errors and returns whatever it resolved — a failed embed
 * must not sink the whole history list, exactly like resolveDayName above.
 */
async function resolveDayNamesByExercise(
  userId: string,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const byExercise = new Map<string, string>();
  if (exerciseIds.length === 0) return byExercise;

  try {
    const { data, error } = await supabase
      .from("day_exercises")
      .select("exercise_id, training_split ( name )")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds);
    if (error) throw error;

    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>;
      const exId = rec.exercise_id as string | undefined;
      const split = rec.training_split as { name?: string } | null | undefined;
      if (exId && split?.name) byExercise.set(exId, split.name);
    }
  } catch {
    // leave the map empty — sessions fall back to the generic "Session" label.
  }
  return byExercise;
}

/**
 * Every past training session, newest first: one entry per distinct log_date,
 * each collapsed to its set count, the day it maps to, the headline (heaviest)
 * lift, and a per-exercise breakdown. Powers the /train/history view. Empty on
 * any failure so the screen shows its own empty state rather than throwing.
 */
export async function fetchSessionHistory(): Promise<SessionHistoryEntry[]> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("set_logs")
      .select("exercise_id, log_date, weight, reps, set_number")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Group rows by their log_date. The query is already date-desc, so the Map
    // preserves newest-first insertion order.
    const byDate = new Map<string, Array<Record<string, unknown>>>();
    for (const row of rows) {
      const rec = row as Record<string, unknown>;
      const date = rec.log_date as string;
      const list = byDate.get(date) ?? [];
      list.push(rec);
      byDate.set(date, list);
    }

    // Resolve every exercise's name + day once, then decorate each session.
    const allExerciseIds = [
      ...new Set(rows.map((r) => (r as Record<string, unknown>).exercise_id as string).filter(Boolean)),
    ];
    const [names, dayNames] = await Promise.all([
      resolveExerciseNames(allExerciseIds),
      resolveDayNamesByExercise(userId, allExerciseIds),
    ]);

    const entries: SessionHistoryEntry[] = [];
    for (const [date, sessionRows] of byDate) {
      // Per-exercise breakdown: set count + heaviest set for that exercise.
      const perExercise = new Map<string, HistoryExercise>();
      let heaviest: { exerciseId: string | null; weight: number; reps: number } | null =
        null;
      let dayName: string | null = null;

      for (const rec of sessionRows) {
        const exId = (rec.exercise_id as string) ?? null;
        const weight = Number(rec.weight) || 0;
        const reps = Number(rec.reps) || 0;

        if (exId && !dayName) dayName = dayNames.get(exId) ?? null;

        const key = exId ?? "unknown";
        const entry =
          perExercise.get(key) ??
          {
            exerciseId: exId,
            name: (exId && names.get(exId)) || "Lift",
            sets: 0,
            topWeight: null as number | null,
            topReps: null as number | null,
          };
        entry.sets += 1;
        if (weight > 0 && (entry.topWeight == null || weight > entry.topWeight)) {
          entry.topWeight = weight;
          entry.topReps = reps || null;
        }
        perExercise.set(key, entry);

        if (
          !heaviest ||
          weight > heaviest.weight ||
          (weight === heaviest.weight && reps > heaviest.reps)
        ) {
          heaviest = { exerciseId: exId, weight, reps };
        }
      }

      const topLift: TopLift | null =
        heaviest && heaviest.exerciseId && heaviest.weight > 0
          ? {
              name: names.get(heaviest.exerciseId) ?? "Lift",
              weight: heaviest.weight,
              reps: heaviest.reps,
            }
          : null;

      entries.push({
        date,
        dayName,
        totalSets: sessionRows.length,
        topLift,
        exercises: [...perExercise.values()],
      });
    }

    return entries;
  } catch {
    reportQueryError("Couldn't load your training history.");
    return [];
  }
}
