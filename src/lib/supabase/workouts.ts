import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import { getCatalogExercise } from "@/lib/split/exerciseCatalog";
import { epley1RM } from "@/lib/train/settings";

/**
 * Data layer for the Strong-style Train tab: routines (templates), live
 * sessions with exercises + sets, personal records (auto-updated on set
 * completion), and body measurements. Reads are defensive (a fresh user has no
 * rows); RLS scopes everything to the caller. Tables live in migration 0026.
 */

/* ================================ types ================================= */

export interface Routine {
  id: string;
  name: string;
  notes: string | null;
  display_order: number;
}

export interface RoutineExercise {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  display_order: number;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
}

export interface WorkoutSession {
  id: string;
  routine_id: string | null;
  name: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  total_volume_kg: number;
  notes: string | null;
  is_active: boolean;
}

export interface SessionSet {
  id: string;
  session_exercise_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_completed: boolean;
  is_warmup: boolean;
  rpe: number | null;
}

export interface SessionExercise {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  display_order: number;
  notes: string | null;
  sets: SessionSet[];
}

export interface PersonalRecord {
  id: string;
  exercise_name: string;
  best_weight_kg: number;
  best_reps: number;
  best_volume_kg: number;
  estimated_1rm: number;
  achieved_at: string;
}

export interface BodyMeasurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arms_cm: number | null;
  thighs_cm: number | null;
  notes: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const nstr = (v: unknown): string | null => (v == null ? null : String(v));

/* ============================ exercise resolve =========================== */

/**
 * Resolves exercise names to `exercises` row ids, reusing existing library/user
 * rows and inserting any unknown name as a user-owned custom exercise. Returns a
 * lower-cased name → id map. Mirrors the onboarding exercises resolver.
 */
async function resolveExerciseIds(
  userId: string,
  names: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: existing } = await supabase
    .from("exercises")
    .select("id, name")
    .in("name", unique);
  for (const row of existing ?? []) {
    map.set(String(row.name).toLowerCase(), String(row.id));
  }

  const missing = unique.filter((n) => !map.has(n.toLowerCase()));
  if (missing.length > 0) {
    const rows = missing.map((name) => {
      const catalog = getCatalogExercise(name);
      return {
        user_id: userId,
        name,
        muscle_group: catalog?.muscleGroup ?? null,
        notes: catalog?.formCue ?? null,
        is_custom: true,
      };
    });
    const { data: inserted } = await supabase
      .from("exercises")
      .insert(rows)
      .select("id, name");
    for (const row of inserted ?? []) {
      map.set(String(row.name).toLowerCase(), String(row.id));
    }
  }
  return map;
}

/* ================================ routines =============================== */

/** Every routine the user has, in display order. */
export async function fetchRoutines(): Promise<Routine[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("workout_routines")
      .select("id, name, notes, display_order")
      .eq("user_id", userId)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      notes: nstr(r.notes),
      display_order: num(r.display_order),
    }));
  } catch {
    return [];
  }
}

/** The exercises assigned to a routine, in order. */
export async function fetchRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  const { data, error } = await supabase
    .from("routine_exercises")
    .select("id, exercise_id, exercise_name, display_order, default_sets, default_reps, default_weight_kg")
    .eq("routine_id", routineId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    exercise_id: nstr(r.exercise_id),
    exercise_name: String(r.exercise_name),
    display_order: num(r.display_order),
    default_sets: num(r.default_sets) || 3,
    default_reps: num(r.default_reps) || 8,
    default_weight_kg: num(r.default_weight_kg),
  }));
}

/** A routine exercise as the builder edits it (before it has a row id). */
export interface RoutineExerciseDraft {
  exercise_name: string;
  exercise_id?: string | null;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
}

/** Creates a routine and returns its id. */
export async function createRoutine(name: string, notes?: string): Promise<string> {
  const userId = await ensureAnonymousSession();
  const routines = await fetchRoutines();
  const { data, error } = await supabase
    .from("workout_routines")
    .insert({ user_id: userId, name: name.trim() || "Routine", notes: notes ?? null, display_order: routines.length })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

/** Renames / re-notes a routine. */
export async function updateRoutine(id: string, patch: { name?: string; notes?: string | null }): Promise<void> {
  const { error } = await supabase
    .from("workout_routines")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Deletes a routine (its exercises cascade). */
export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from("workout_routines").delete().eq("id", id);
  if (error) throw error;
}

/** Replaces a routine's exercise list with `drafts`, in order. */
export async function setRoutineExercises(routineId: string, drafts: RoutineExerciseDraft[]): Promise<void> {
  const userId = await ensureAnonymousSession();
  await supabase.from("routine_exercises").delete().eq("routine_id", routineId);
  if (drafts.length === 0) return;
  const idByName = await resolveExerciseIds(userId, drafts.map((d) => d.exercise_name));
  const rows = drafts.map((d, i) => ({
    routine_id: routineId,
    exercise_id: d.exercise_id ?? idByName.get(d.exercise_name.toLowerCase()) ?? null,
    exercise_name: d.exercise_name,
    display_order: i,
    default_sets: d.default_sets,
    default_reps: d.default_reps,
    default_weight_kg: d.default_weight_kg,
  }));
  const { error } = await supabase.from("routine_exercises").insert(rows);
  if (error) throw error;
}

/* ============================ default routines =========================== */

const DEFAULT_ROUTINES: { name: string; exercises: string[] }[] = [
  { name: "Push", exercises: ["Bench Press", "Overhead Press", "Incline Dumbbell Press", "Triceps Pushdown", "Lateral Raise"] },
  { name: "Pull", exercises: ["Deadlift", "Barbell Row", "Lat Pulldown", "Barbell Curl", "Face Pull"] },
  { name: "Legs", exercises: ["Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Standing Calf Raise"] },
];

/**
 * Seeds the three starter routines (Push / Pull / Legs) the first time a user
 * opens Train with no routines. Idempotent: no-op once any routine exists.
 */
export async function seedDefaultRoutines(): Promise<void> {
  const existing = await fetchRoutines();
  if (existing.length > 0) return;
  for (const r of DEFAULT_ROUTINES) {
    const id = await createRoutine(r.name);
    await setRoutineExercises(
      id,
      r.exercises.map((name) => ({ exercise_name: name, default_sets: 3, default_reps: 8, default_weight_kg: 0 }))
    );
  }
}

/* ================================ sessions =============================== */

/** The user's in-progress session, or null. */
export async function fetchActiveSession(): Promise<WorkoutSession | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id, routine_id, name, started_at, finished_at, duration_seconds, total_volume_kg, notes, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data) : null;
  } catch {
    return null;
  }
}

function toSession(r: Record<string, unknown>): WorkoutSession {
  return {
    id: String(r.id),
    routine_id: nstr(r.routine_id),
    name: String(r.name),
    started_at: String(r.started_at),
    finished_at: nstr(r.finished_at),
    duration_seconds: r.duration_seconds == null ? null : num(r.duration_seconds),
    total_volume_kg: num(r.total_volume_kg),
    notes: nstr(r.notes),
    is_active: Boolean(r.is_active),
  };
}

/**
 * Starts a new session. If `routineId` is given, copies that routine's
 * exercises into session_exercises and pre-fills each with its default number
 * of (uncompleted) sets. Returns the new session id.
 */
export async function startSession(opts: { routineId?: string | null; name: string }): Promise<string> {
  const userId = await ensureAnonymousSession();
  const { data: sess, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, routine_id: opts.routineId ?? null, name: opts.name.trim() || "Workout", is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  const sessionId = String(sess.id);

  if (opts.routineId) {
    const routineExercises = await fetchRoutineExercises(opts.routineId);
    for (const rx of routineExercises) {
      const { data: se } = await supabase
        .from("session_exercises")
        .insert({
          session_id: sessionId,
          exercise_id: rx.exercise_id,
          exercise_name: rx.exercise_name,
          display_order: rx.display_order,
        })
        .select("id")
        .single();
      if (!se) continue;
      const setRows = Array.from({ length: Math.max(1, rx.default_sets) }, (_, i) => ({
        session_exercise_id: String(se.id),
        user_id: userId,
        exercise_id: rx.exercise_id,
        exercise_name: rx.exercise_name,
        set_number: i + 1,
        weight_kg: rx.default_weight_kg,
        reps: rx.default_reps,
        is_completed: false,
      }));
      await supabase.from("session_sets").insert(setRows);
    }
  }
  return sessionId;
}

/** A session with its exercises and their sets (for the workout screen). */
export interface SessionDetail {
  session: WorkoutSession;
  exercises: SessionExercise[];
}

/** Loads a session plus every exercise and set, ordered for display. */
export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const userId = await ensureAnonymousSession();
  const { data: s, error: se } = await supabase
    .from("workout_sessions")
    .select("id, routine_id, name, started_at, finished_at, duration_seconds, total_volume_kg, notes, is_active")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();
  if (se || !s) return null;

  const { data: exRows } = await supabase
    .from("session_exercises")
    .select("id, exercise_id, exercise_name, display_order, notes")
    .eq("session_id", sessionId)
    .order("display_order", { ascending: true });

  const exIds = (exRows ?? []).map((e) => String(e.id));
  const { data: setRows } = exIds.length
    ? await supabase
        .from("session_sets")
        .select("id, session_exercise_id, exercise_id, exercise_name, set_number, weight_kg, reps, is_completed, is_warmup, rpe")
        .in("session_exercise_id", exIds)
        .order("set_number", { ascending: true })
    : { data: [] as Record<string, unknown>[] };

  const setsByExercise = new Map<string, SessionSet[]>();
  for (const r of setRows ?? []) {
    const list = setsByExercise.get(String(r.session_exercise_id)) ?? [];
    list.push({
      id: String(r.id),
      session_exercise_id: String(r.session_exercise_id),
      exercise_id: nstr(r.exercise_id),
      exercise_name: String(r.exercise_name),
      set_number: num(r.set_number),
      weight_kg: num(r.weight_kg),
      reps: num(r.reps),
      is_completed: Boolean(r.is_completed),
      is_warmup: Boolean(r.is_warmup),
      rpe: r.rpe == null ? null : num(r.rpe),
    });
    setsByExercise.set(String(r.session_exercise_id), list);
  }

  const exercises: SessionExercise[] = (exRows ?? []).map((e) => ({
    id: String(e.id),
    exercise_id: nstr(e.exercise_id),
    exercise_name: String(e.exercise_name),
    display_order: num(e.display_order),
    notes: nstr(e.notes),
    sets: setsByExercise.get(String(e.id)) ?? [],
  }));

  return { session: toSession(s), exercises };
}

/* ============================ session mutations ========================== */

/** Adds an exercise to a session and seeds one empty set. Returns its id. */
export async function addSessionExercise(
  sessionId: string,
  exerciseName: string,
  exerciseId?: string | null
): Promise<string | null> {
  const userId = await ensureAnonymousSession();
  const existing = await supabase
    .from("session_exercises")
    .select("display_order")
    .eq("session_id", sessionId);
  const order = (existing.data ?? []).length;
  let resolvedId = exerciseId ?? null;
  if (!resolvedId) {
    const map = await resolveExerciseIds(userId, [exerciseName]);
    resolvedId = map.get(exerciseName.toLowerCase()) ?? null;
  }
  const { data, error } = await supabase
    .from("session_exercises")
    .insert({ session_id: sessionId, exercise_id: resolvedId, exercise_name: exerciseName, display_order: order })
    .select("id")
    .single();
  if (error || !data) return null;
  const seId = String(data.id);
  await supabase.from("session_sets").insert({
    session_exercise_id: seId,
    user_id: userId,
    exercise_id: resolvedId,
    exercise_name: exerciseName,
    set_number: 1,
    weight_kg: 0,
    reps: 0,
    is_completed: false,
  });
  return seId;
}

/** Removes an exercise (its sets cascade). */
export async function deleteSessionExercise(id: string): Promise<void> {
  await supabase.from("session_exercises").delete().eq("id", id);
}

/** Appends a set to an exercise. Returns the new set id. */
export async function addSet(
  se: { id: string; exercise_id: string | null; exercise_name: string },
  setNumber: number,
  seed: { weight_kg: number; reps: number }
): Promise<string | null> {
  const userId = await ensureAnonymousSession();
  const { data, error } = await supabase
    .from("session_sets")
    .insert({
      session_exercise_id: se.id,
      user_id: userId,
      exercise_id: se.exercise_id,
      exercise_name: se.exercise_name,
      set_number: setNumber,
      weight_kg: seed.weight_kg,
      reps: seed.reps,
      is_completed: false,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return String(data.id);
}

/** Deletes one set. */
export async function deleteSet(id: string): Promise<void> {
  await supabase.from("session_sets").delete().eq("id", id);
}

/** Updates a set's weight / reps / warmup / rpe. */
export async function updateSet(
  id: string,
  patch: Partial<{ weight_kg: number; reps: number; is_warmup: boolean; rpe: number | null }>
): Promise<void> {
  const { error } = await supabase.from("session_sets").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Marks a set completed/uncompleted. On completion, stamps logged_at and
 * updates the personal record for that exercise (PRs are auto-maintained here).
 */
export async function setCompleted(
  set: { id: string; exercise_id: string | null; exercise_name: string; weight_kg: number; reps: number },
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from("session_sets")
    .update({ is_completed: completed, logged_at: completed ? new Date().toISOString() : null })
    .eq("id", set.id);
  if (error) throw error;
  if (completed) {
    await updatePersonalRecord(set.exercise_name, set.exercise_id, set.weight_kg, set.reps);
  }
}

/**
 * Upserts the personal record for an exercise: keeps the best weight, best reps,
 * best single-set volume, and best Epley 1RM ever seen. Only ratchets upward.
 */
async function updatePersonalRecord(
  exerciseName: string,
  exerciseId: string | null,
  weightKg: number,
  reps: number
): Promise<void> {
  if (weightKg <= 0 && reps <= 0) return;
  const userId = await ensureAnonymousSession();
  const volume = weightKg * reps;
  const e1rm = epley1RM(weightKg, reps);

  const { data: current } = await supabase
    .from("personal_records")
    .select("id, best_weight_kg, best_reps, best_volume_kg, estimated_1rm")
    .eq("user_id", userId)
    .eq("exercise_name", exerciseName)
    .maybeSingle();

  const next = {
    user_id: userId,
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    best_weight_kg: Math.max(num(current?.best_weight_kg), weightKg),
    best_reps: Math.max(num(current?.best_reps), reps),
    best_volume_kg: Math.max(num(current?.best_volume_kg), volume),
    estimated_1rm: Math.max(num(current?.estimated_1rm), e1rm),
    updated_at: new Date().toISOString(),
  };
  await supabase.from("personal_records").upsert(next, { onConflict: "user_id,exercise_name" });
}

/** Updates the session's free-text notes. */
export async function updateSessionNotes(id: string, notes: string): Promise<void> {
  await supabase.from("workout_sessions").update({ notes }).eq("id", id);
}

/**
 * Finishes a session: totals the completed sets' volume, stamps finished_at +
 * duration, and flips is_active off. Returns the volume + duration logged.
 */
export async function finishSession(id: string): Promise<{ volume: number; durationSeconds: number }> {
  const detail = await fetchSessionDetail(id);
  if (!detail) return { volume: 0, durationSeconds: 0 };
  let volume = 0;
  for (const ex of detail.exercises) {
    for (const s of ex.sets) {
      if (s.is_completed) volume += s.weight_kg * s.reps;
    }
  }
  const started = new Date(detail.session.started_at).getTime();
  const durationSeconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  await supabase
    .from("workout_sessions")
    .update({
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      total_volume_kg: volume,
      is_active: false,
    })
    .eq("id", id);
  return { volume, durationSeconds };
}

/** Discards a session entirely (exercises + sets cascade). */
export async function discardSession(id: string): Promise<void> {
  await supabase.from("workout_sessions").delete().eq("id", id);
}

/* ========================= history / progress / PRs ====================== */

/** A finished session for the History list. */
export interface HistoryEntry extends WorkoutSession {
  setCount: number;
  exerciseCount: number;
}

/** Finished sessions, newest first, with set/exercise counts. */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id, routine_id, name, started_at, finished_at, duration_seconds, total_volume_kg, notes, is_active")
      .eq("user_id", userId)
      .eq("is_active", false)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const sessions = (data ?? []).map(toSession);
    if (sessions.length === 0) return [];

    const ids = sessions.map((s) => s.id);
    const { data: exRows } = await supabase
      .from("session_exercises")
      .select("id, session_id")
      .in("session_id", ids);
    const exBySession = new Map<string, string[]>();
    for (const e of exRows ?? []) {
      const list = exBySession.get(String(e.session_id)) ?? [];
      list.push(String(e.id));
      exBySession.set(String(e.session_id), list);
    }
    const allExIds = (exRows ?? []).map((e) => String(e.id));
    const { data: setRows } = allExIds.length
      ? await supabase.from("session_sets").select("session_exercise_id, is_completed").in("session_exercise_id", allExIds)
      : { data: [] as Record<string, unknown>[] };
    const setCountByEx = new Map<string, number>();
    for (const s of setRows ?? []) {
      if (!s.is_completed) continue;
      const k = String(s.session_exercise_id);
      setCountByEx.set(k, (setCountByEx.get(k) ?? 0) + 1);
    }

    return sessions.map((s) => {
      const exIds = exBySession.get(s.id) ?? [];
      const setCount = exIds.reduce((sum, e) => sum + (setCountByEx.get(e) ?? 0), 0);
      return { ...s, exerciseCount: exIds.length, setCount };
    });
  } catch {
    return [];
  }
}

/** All personal records, best 1RM first. */
export async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("personal_records")
      .select("id, exercise_name, best_weight_kg, best_reps, best_volume_kg, estimated_1rm, achieved_at")
      .eq("user_id", userId)
      .order("estimated_1rm", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      exercise_name: String(r.exercise_name),
      best_weight_kg: num(r.best_weight_kg),
      best_reps: num(r.best_reps),
      best_volume_kg: num(r.best_volume_kg),
      estimated_1rm: num(r.estimated_1rm),
      achieved_at: String(r.achieved_at),
    }));
  } catch {
    return [];
  }
}

/** Distinct exercise names the user has logged completed sets for. */
export async function fetchLoggedExerciseNames(): Promise<string[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("session_sets")
      .select("exercise_name")
      .eq("user_id", userId)
      .eq("is_completed", true);
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => String(r.exercise_name)))].sort();
  } catch {
    return [];
  }
}

/** A point in an exercise's progress line: best est-1RM logged that day. */
export interface ProgressPoint {
  date: string;
  best1rm: number;
  topWeight: number;
}

/** Per-day best 1RM + top weight for one exercise, oldest → newest. */
export async function fetchExerciseProgress(exerciseName: string): Promise<ProgressPoint[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("session_sets")
      .select("weight_kg, reps, logged_at")
      .eq("user_id", userId)
      .eq("exercise_name", exerciseName)
      .eq("is_completed", true)
      .not("logged_at", "is", null)
      .order("logged_at", { ascending: true });
    if (error) throw error;
    const byDate = new Map<string, ProgressPoint>();
    for (const r of data ?? []) {
      const date = String(r.logged_at).slice(0, 10);
      const w = num(r.weight_kg);
      const e = epley1RM(w, num(r.reps));
      const cur = byDate.get(date) ?? { date, best1rm: 0, topWeight: 0 };
      cur.best1rm = Math.max(cur.best1rm, e);
      cur.topWeight = Math.max(cur.topWeight, w);
      byDate.set(date, cur);
    }
    return [...byDate.values()];
  } catch {
    return [];
  }
}

/* =============================== measurements ============================ */

/** Body measurements, newest first. */
export async function fetchMeasurements(): Promise<BodyMeasurement[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("body_measurements")
      .select("id, measured_at, weight_kg, body_fat_percent, chest_cm, waist_cm, hips_cm, arms_cm, thighs_cm, notes")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      measured_at: String(r.measured_at),
      weight_kg: r.weight_kg == null ? null : num(r.weight_kg),
      body_fat_percent: r.body_fat_percent == null ? null : num(r.body_fat_percent),
      chest_cm: r.chest_cm == null ? null : num(r.chest_cm),
      waist_cm: r.waist_cm == null ? null : num(r.waist_cm),
      hips_cm: r.hips_cm == null ? null : num(r.hips_cm),
      arms_cm: r.arms_cm == null ? null : num(r.arms_cm),
      thighs_cm: r.thighs_cm == null ? null : num(r.thighs_cm),
      notes: nstr(r.notes),
    }));
  } catch {
    return [];
  }
}

/** Logs a new body-measurement row. */
export async function addMeasurement(
  patch: Partial<Omit<BodyMeasurement, "id" | "measured_at">> & { measured_at?: string }
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase.from("body_measurements").insert({ user_id: userId, ...patch });
  if (error) throw error;
}
