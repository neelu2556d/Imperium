import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import {
  DEFAULT_REPS,
  DEFAULT_SETS,
  getCatalogExercise,
  type MuscleGroup,
} from "@/lib/split/exerciseCatalog";

/** A row in the exercise library, as the pick-exercises screen consumes it. */
export interface ExerciseHit {
  /** Present when the row is backed by a Supabase `exercises` row. */
  id: string | null;
  name: string;
  muscleGroup: MuscleGroup | null;
  /** One-line form cue for the info tooltip. */
  formCue: string | null;
}

/** One exercise picked for a day, with its prescription from the Tune sheet. */
export interface DayPick extends ExerciseHit {
  sets: number;
  reps: number;
}

function rowToHit(row: Record<string, unknown>): ExerciseHit {
  const name = row.name as string;
  const catalog = getCatalogExercise(name);
  return {
    id: (row.id as string) ?? null,
    name,
    muscleGroup: (row.muscle_group as MuscleGroup | null) ?? catalog?.muscleGroup ?? null,
    formCue: (row.notes as string | null) ?? catalog?.formCue ?? null,
  };
}

/**
 * Searches the shared exercise library by name. Hits Supabase first; the caller
 * is expected to fall back to the local catalog if this rejects (offline) or
 * returns nothing (library not seeded yet).
 */
export async function searchExercises(query: string): Promise<ExerciseHit[]> {
  const q = query.trim();
  if (!q) return [];

  await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, notes")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(12);

  if (error) throw error;

  return (data ?? []).map(rowToHit);
}

/**
 * Loads the picks already saved for a set of training-day ids, grouped by
 * `training_split_id`, each ordered by `exercise_order`. Empty map if none.
 */
export async function fetchDayExercises(
  splitIds: string[]
): Promise<Record<string, DayPick[]>> {
  const byDay: Record<string, DayPick[]> = {};
  if (splitIds.length === 0) return byDay;

  await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("day_exercises")
    .select(
      "training_split_id, exercise_order, prescribed_sets, prescribed_reps, exercises ( id, name, muscle_group, notes )"
    )
    .in("training_split_id", splitIds)
    .order("exercise_order", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const splitId = (row as Record<string, unknown>).training_split_id as string;
    const exercise = (row as Record<string, unknown>).exercises as
      | Record<string, unknown>
      | null;
    if (!exercise) continue;

    (byDay[splitId] ??= []).push({
      ...rowToHit(exercise),
      sets: ((row as Record<string, unknown>).prescribed_sets as number) ?? DEFAULT_SETS,
      reps: ((row as Record<string, unknown>).prescribed_reps as number) ?? DEFAULT_REPS,
    });
  }

  return byDay;
}

/**
 * Resolves a list of exercise names to `exercises` row ids. Existing library
 * (or the user's own) rows are reused; any name the library doesn't have yet is
 * inserted as a user-owned custom exercise (form cue from the local catalog, if
 * known). Returns a lower-cased name → id map.
 */
async function resolveExerciseIds(
  userId: string,
  names: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: existing, error } = await supabase
    .from("exercises")
    .select("id, name")
    .in("name", unique);

  if (error) throw error;

  for (const row of existing ?? []) {
    map.set((row.name as string).toLowerCase(), row.id as string);
  }

  const missing = unique.filter((name) => !map.has(name.toLowerCase()));
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

    const { data: inserted, error: insertError } = await supabase
      .from("exercises")
      .insert(rows)
      .select("id, name");

    if (insertError) throw insertError;

    for (const row of inserted ?? []) {
      map.set((row.name as string).toLowerCase(), row.id as string);
    }
  }

  return map;
}

/** The picks for one training day, ready to persist. */
export interface DayExercisePlan {
  splitId: string;
  picks: DayPick[];
}

/**
 * Persists every day's picks. For each day it clears the existing rows and
 * re-inserts the current list in display order with each exercise's prescribed
 * sets × reps, resolving names to library ids first. Runs the days in sequence
 * so a mid-flight failure surfaces cleanly.
 */
export async function saveAllDayExercises(
  plans: DayExercisePlan[]
): Promise<void> {
  const userId = await ensureAnonymousSession();

  const allNames = plans.flatMap((plan) => plan.picks.map((p) => p.name));
  const idByName = await resolveExerciseIds(userId, allNames);

  for (const plan of plans) {
    const { error: deleteError } = await supabase
      .from("day_exercises")
      .delete()
      .eq("training_split_id", plan.splitId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    const rows = plan.picks
      .map((pick, index) => {
        const exerciseId = pick.id ?? idByName.get(pick.name.toLowerCase());
        if (!exerciseId) return null;
        return {
          user_id: userId,
          training_split_id: plan.splitId,
          exercise_id: exerciseId,
          exercise_order: index,
          prescribed_sets: pick.sets,
          prescribed_reps: pick.reps,
          is_pick: true,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) continue;

    const { error: insertError } = await supabase
      .from("day_exercises")
      .insert(rows);

    if (insertError) throw insertError;
  }
}
