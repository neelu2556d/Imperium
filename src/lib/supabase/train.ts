import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

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
 * The user's account-creation date, read from their Supabase auth user. This
 * is the anchor the split cycles from. Null if there's somehow no session.
 */
export async function fetchAccountCreatedAt(): Promise<Date | null> {
  try {
    await ensureAnonymousSession();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const created = session?.user?.created_at;
    return created ? new Date(created) : null;
  } catch {
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

/** Maps a set of exercise ids to their display names. */
async function resolveExerciseNames(
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (exerciseIds.length === 0) return names;

  const { data, error } = await supabase
    .from("exercises")
    .select("id, name")
    .in("id", exerciseIds);
  if (error) throw error;

  for (const row of data ?? []) {
    names.set(row.id as string, row.name as string);
  }
  return names;
}

/**
 * The split day a session belongs to, inferred from any of its exercises via
 * day_exercises → training_split. Null when the exercises aren't mapped to a
 * day (e.g. logged ad-hoc, or picks cleared since).
 */
async function resolveDayName(
  userId: string,
  exerciseIds: string[]
): Promise<string | null> {
  if (exerciseIds.length === 0) return null;

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
    return null;
  }
}
