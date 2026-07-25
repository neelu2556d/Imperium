import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import type { MuscleGroup } from "@/lib/split/exerciseCatalog";
import { isCompoundTier, type LastSessionStat } from "@/lib/train/overload";

/**
 * Data layer for the /train/session/[day_id] logging screen. Like the /train
 * dashboard layer it is defensive: a brand-new user may have a day with no
 * picks and no history, so reads return empty shapes instead of throwing. The
 * writes (log a set, swap an exercise, finish the session) do surface errors so
 * the screen can show a retry — logging is the one place a silent failure would
 * lose the user's work.
 */

/** Local YYYY-MM-DD for the user's wall clock — how log_date is stored/read. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Header facts for the session: the day's name and where it sits in the split. */
export interface SessionDay {
  id: string;
  name: string;
  isRest: boolean;
  /** 1-based position among the split's training (non-rest) days. */
  dayNumber: number;
  /** Count of training (non-rest) days in the split. */
  trainingDayCount: number;
}

/** One prescribed set that has already been logged (today, or in the swap flow). */
export interface LoggedSet {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isDeload: boolean;
}

/** An exercise picked for this day, with everything the card needs to render. */
export interface SessionExercise {
  /** day_exercises row id — the swap flow updates this row. */
  rowId: string;
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  tier: string | null;
  isCompound: boolean;
  formCue: string | null;
  prescribedSets: number;
  prescribedReps: number;
  /** Most recent completed session's carry-forward stat (drives suggestions). */
  last: LastSessionStat;
  /** The raw weight of the last session, for the "LAST [x]kg" sub-label. */
  lastWeight: number | null;
  /** Sets already logged today, keyed for the card to mark them done on load. */
  loggedToday: LoggedSet[];
}

/**
 * The session day's header facts. Resolves the day's position among the split's
 * training days ("DAY 2 OF 4"). Null if the id doesn't resolve to a day.
 */
export async function fetchSessionDay(dayId: string): Promise<SessionDay | null> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("training_split")
      .select("id, name, is_rest_day, day_order")
      .eq("user_id", userId)
      .order("day_order", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const training = rows.filter((r) => !r.is_rest_day);
    const idx = training.findIndex((r) => r.id === dayId);
    const self = rows.find((r) => r.id === dayId);
    if (!self) return null;

    return {
      id: self.id as string,
      name: self.name as string,
      isRest: Boolean(self.is_rest_day),
      dayNumber: idx >= 0 ? idx + 1 : 1,
      trainingDayCount: training.length,
    };
  } catch {
    return null;
  }
}

/** Groups a flat run of set rows (newest date first) into per-exercise last stats. */
function computeLastStats(
  rows: Array<Record<string, unknown>>,
  prescribedRepsById: Map<string, number>
): Map<string, { weight: number | null; allRepsHit: boolean }> {
  // Rows arrive ordered by log_date desc, so the first date we see per exercise
  // is its most recent session. We collect just that date's sets per exercise.
  const latestDate = new Map<string, string>();
  const setsByExercise = new Map<string, Array<{ weight: number; reps: number }>>();

  for (const row of rows) {
    const exId = row.exercise_id as string;
    const date = row.log_date as string;
    const seen = latestDate.get(exId);
    if (seen === undefined) latestDate.set(exId, date);
    if (latestDate.get(exId) !== date) continue; // older session — skip

    const weight = Number(row.weight);
    const reps = Number(row.reps);
    if (!Number.isFinite(weight)) continue;
    const list = setsByExercise.get(exId) ?? [];
    list.push({ weight, reps: Number.isFinite(reps) ? reps : 0 });
    setsByExercise.set(exId, list);
  }

  const out = new Map<string, { weight: number | null; allRepsHit: boolean }>();
  for (const [exId, sets] of setsByExercise) {
    const target = prescribedRepsById.get(exId) ?? 0;
    const topWeight = sets.reduce((m, s) => Math.max(m, s.weight), 0);
    const allRepsHit = sets.length > 0 && sets.every((s) => s.reps >= target);
    out.set(exId, { weight: topWeight || null, allRepsHit });
  }
  return out;
}

/**
 * Every exercise picked for this day, in display order, each carrying its
 * prescription, its last-session carry-forward stat (for suggestions), and any
 * sets already logged today (so a reload restores the checked rows).
 */
export async function fetchSessionExercises(
  dayId: string
): Promise<SessionExercise[]> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("day_exercises")
      .select(
        "id, exercise_id, exercise_order, prescribed_sets, prescribed_reps, exercises ( id, name, muscle_group, tier, notes )"
      )
      .eq("training_split_id", dayId)
      .eq("user_id", userId)
      .order("exercise_order", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []).filter(
      (r) => (r as Record<string, unknown>).exercises
    );
    const exerciseIds = rows.map(
      (r) => (r as Record<string, unknown>).exercise_id as string
    );

    const prescribedRepsById = new Map<string, number>();
    for (const r of rows) {
      const rec = r as Record<string, unknown>;
      prescribedRepsById.set(
        rec.exercise_id as string,
        (rec.prescribed_reps as number) ?? 12
      );
    }

    const today = todayISO();

    // Last completed sessions (strictly before today) for the suggestions, and
    // anything already logged today for restoring the checked state.
    const [historyRes, todayRes] = await Promise.all([
      exerciseIds.length
        ? supabase
            .from("set_logs")
            .select("exercise_id, log_date, weight, reps")
            .eq("user_id", userId)
            .in("exercise_id", exerciseIds)
            .lt("log_date", today)
            .order("log_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      exerciseIds.length
        ? supabase
            .from("set_logs")
            .select("exercise_id, set_number, weight, reps, rpe, is_deload")
            .eq("user_id", userId)
            .in("exercise_id", exerciseIds)
            .eq("log_date", today)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (historyRes.error) throw historyRes.error;
    if (todayRes.error) throw todayRes.error;

    const lastStats = computeLastStats(
      (historyRes.data ?? []) as Array<Record<string, unknown>>,
      prescribedRepsById
    );

    const loggedByExercise = new Map<string, LoggedSet[]>();
    for (const row of todayRes.data ?? []) {
      const rec = row as Record<string, unknown>;
      const exId = rec.exercise_id as string;
      const list = loggedByExercise.get(exId) ?? [];
      list.push({
        setNumber: (rec.set_number as number) ?? list.length + 1,
        weight: rec.weight != null ? Number(rec.weight) : null,
        reps: rec.reps != null ? Number(rec.reps) : null,
        rpe: rec.rpe != null ? Number(rec.rpe) : null,
        isDeload: Boolean(rec.is_deload),
      });
      loggedByExercise.set(exId, list);
    }

    return rows.map((r) => {
      const rec = r as Record<string, unknown>;
      const ex = rec.exercises as Record<string, unknown>;
      const exId = rec.exercise_id as string;
      const tier = (ex.tier as string | null) ?? null;
      const stat = lastStats.get(exId) ?? { weight: null, allRepsHit: false };

      return {
        rowId: rec.id as string,
        exerciseId: exId,
        name: ex.name as string,
        muscleGroup: (ex.muscle_group as MuscleGroup | null) ?? null,
        tier,
        isCompound: isCompoundTier(tier),
        formCue: (ex.notes as string | null) ?? null,
        prescribedSets: (rec.prescribed_sets as number) ?? 3,
        prescribedReps: (rec.prescribed_reps as number) ?? 12,
        last: stat,
        lastWeight: stat.weight,
        loggedToday: (loggedByExercise.get(exId) ?? []).sort(
          (a, b) => a.setNumber - b.setNumber
        ),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Records one set. Because a user can re-tap "HIT IT" to correct a set they
 * already logged today, this replaces any existing row for the same
 * (exercise, set, today) rather than stacking duplicates.
 */
export async function logSet(input: {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  isDeload: boolean;
}): Promise<void> {
  const userId = await ensureAnonymousSession();
  const date = todayISO();

  const { error: delError } = await supabase
    .from("set_logs")
    .delete()
    .eq("user_id", userId)
    .eq("exercise_id", input.exerciseId)
    .eq("log_date", date)
    .eq("set_number", input.setNumber);
  if (delError) throw delError;

  const { error } = await supabase.from("set_logs").insert({
    user_id: userId,
    exercise_id: input.exerciseId,
    log_date: date,
    set_number: input.setNumber,
    weight: input.weight,
    reps: input.reps,
    rpe: input.rpe,
    is_deload: input.isDeload,
  });
  if (error) throw error;
}

/**
 * Adds an exercise to a session by hand (the "+ Add exercise" sheet). Resolves
 * the pick to an `exercises` row — reusing a library row when one matches the
 * name, otherwise inserting a user-owned custom exercise — and, for the
 * "always" scope, appends it to the day's picks in day_exercises. The "today"
 * scope stays session-local (sets still log against the real exercise id, so
 * history and progress graphs work either way). Returns the ready-to-render
 * SessionExercise. Throws on failure so the screen can surface a retry.
 */
export async function addSessionExercise(
  dayId: string,
  pick: {
    id: string | null;
    name: string;
    muscleGroup: MuscleGroup | null;
    formCue: string | null;
  },
  scope: "today" | "always",
  prescribedSets = 4,
  prescribedReps = 8
): Promise<SessionExercise> {
  const userId = await ensureAnonymousSession();
  const name = pick.name.trim();

  // Resolve to an exercises row: given id → name match → new custom row.
  let exerciseId = pick.id;
  if (!exerciseId) {
    const { data: existing, error: lookupError } = await supabase
      .from("exercises")
      .select("id")
      .ilike("name", name)
      .limit(1);
    if (lookupError) throw lookupError;
    exerciseId = (existing?.[0]?.id as string | undefined) ?? null;
  }
  if (!exerciseId) {
    const { data: inserted, error: insertError } = await supabase
      .from("exercises")
      .insert({
        user_id: userId,
        name,
        muscle_group: pick.muscleGroup,
        notes: pick.formCue,
        is_custom: true,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    exerciseId = inserted.id as string;
  }

  // "Always" → persist to the day's picks, appended after the existing order.
  let rowId = `today-${exerciseId}`;
  if (scope === "always") {
    const { data: lastOrder, error: orderError } = await supabase
      .from("day_exercises")
      .select("exercise_order")
      .eq("training_split_id", dayId)
      .eq("user_id", userId)
      .order("exercise_order", { ascending: false })
      .limit(1);
    if (orderError) throw orderError;

    const nextOrder = ((lastOrder?.[0]?.exercise_order as number | undefined) ?? -1) + 1;
    const { data: row, error: rowError } = await supabase
      .from("day_exercises")
      .insert({
        user_id: userId,
        training_split_id: dayId,
        exercise_id: exerciseId,
        exercise_order: nextOrder,
        prescribed_sets: prescribedSets,
        prescribed_reps: prescribedReps,
        is_pick: true,
      })
      .select("id")
      .single();
    if (rowError) throw rowError;
    rowId = row.id as string;
  }

  return {
    rowId,
    exerciseId,
    name,
    muscleGroup: pick.muscleGroup,
    tier: null,
    isCompound: false,
    formCue: pick.formCue,
    prescribedSets,
    prescribedReps,
    last: { weight: null, allRepsHit: false },
    lastWeight: null,
    loggedToday: [],
  };
}

/**
 * Swaps the exercise on a day_exercises row for another (the "always" branch of
 * the swap sheet — "today only" is handled in the screen's local state). Carries
 * the existing prescription over to the replacement.
 */
export async function swapDayExercise(
  rowId: string,
  newExerciseId: string
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("day_exercises")
    .update({ exercise_id: newExerciseId })
    .eq("id", rowId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** One past session of an exercise, for the history sheet. */
export interface HistoryEntry {
  date: string;
  sets: Array<{ weight: number | null; reps: number | null }>;
  /** Top-set weight that day — the sparkline's data point. */
  topWeight: number;
}

/**
 * Every past session for an exercise, newest first, each collapsed to its set
 * list plus a top-set weight for the progression sparkline.
 */
export async function fetchExerciseHistory(
  exerciseId: string
): Promise<HistoryEntry[]> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("set_logs")
      .select("log_date, set_number, weight, reps")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true });
    if (error) throw error;

    const byDate = new Map<string, HistoryEntry>();
    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>;
      const date = rec.log_date as string;
      const weight = rec.weight != null ? Number(rec.weight) : null;
      const reps = rec.reps != null ? Number(rec.reps) : null;
      const entry =
        byDate.get(date) ?? { date, sets: [], topWeight: 0 };
      entry.sets.push({ weight, reps });
      if (weight != null) entry.topWeight = Math.max(entry.topWeight, weight);
      byDate.set(date, entry);
    }

    return [...byDate.values()];
  } catch {
    return [];
  }
}

/** One session's worth of data for the progressive-overload graph. */
export interface ProgressPoint {
  /** Local YYYY-MM-DD the session was logged. */
  date: string;
  /** Top-set weight that session — the primary (left-axis) line. */
  weight: number;
  /** Reps of that top set (for the tooltip). */
  reps: number | null;
  /** Number of sets logged that session. */
  sets: number;
  /** Total tonnage: Σ(weight × reps) across the session's sets — the ghost line. */
  volume: number;
}

/**
 * Every logged session for an exercise, oldest → newest, each collapsed to the
 * points the overload graph plots: top-set weight, total volume, and enough
 * detail (reps, set count) to fill the on-tap tooltip. Empty on any failure so
 * the graph can fall back to its placeholder rather than throw.
 */
export async function fetchExerciseProgress(
  exerciseId: string
): Promise<ProgressPoint[]> {
  try {
    const userId = await ensureAnonymousSession();

    const { data, error } = await supabase
      .from("set_logs")
      .select("log_date, set_number, weight, reps")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .order("log_date", { ascending: true })
      .order("set_number", { ascending: true });
    if (error) throw error;

    // Rows arrive date-ascending, so the Map keeps sessions in chronological
    // order. Per session we track the heaviest set (its weight + reps drive the
    // weight line and tooltip) and accumulate tonnage for the volume line.
    const byDate = new Map<string, ProgressPoint>();
    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>;
      const date = rec.log_date as string;
      const weight = rec.weight != null ? Number(rec.weight) : null;
      const reps = rec.reps != null ? Number(rec.reps) : null;

      const entry =
        byDate.get(date) ?? { date, weight: 0, reps: null, sets: 0, volume: 0 };
      entry.sets += 1;
      if (weight != null && Number.isFinite(weight)) {
        entry.volume += weight * (reps ?? 0);
        if (weight > entry.weight) {
          entry.weight = weight;
          entry.reps = reps;
        }
      }
      byDate.set(date, entry);
    }

    // Drop sessions with no usable weight — they'd plot as a spurious zero.
    return [...byDate.values()].filter((p) => p.weight > 0);
  } catch {
    return [];
  }
}

/** Resolves an exercise id to its display name (for the standalone graph view). */
export async function fetchExerciseName(
  exerciseId: string
): Promise<string | null> {
  try {
    await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("exercises")
      .select("name")
      .eq("id", exerciseId)
      .maybeSingle();
    if (error) throw error;
    return (data?.name as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Marks the session complete for today. Upserts on (day, date) so re-finishing
 * (e.g. after logging one more set) updates rather than duplicates.
 */
export async function finishSession(
  dayId: string,
  isDeload: boolean
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("session_completions")
    .upsert(
      {
        user_id: userId,
        training_split_id: dayId,
        completed_date: todayISO(),
        is_deload: isDeload,
      },
      { onConflict: "training_split_id,completed_date" }
    );
  if (error) throw error;
}
