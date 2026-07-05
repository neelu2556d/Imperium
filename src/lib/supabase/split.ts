import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import type { SplitDay } from "@/lib/split/templates";

/**
 * Replaces the user's training split with `days`, ordered Mon → Sun. Because a
 * split is many rows (one per day), this deletes the user's existing rows and
 * inserts the new set rather than upserting a single row. Rest days are stored
 * too, so `day_order` always maps cleanly onto the seven-day week.
 */
export async function saveTrainingSplit(days: SplitDay[]): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error: deleteError } = await supabase
    .from("training_split")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  const rows = days.map((day, index) => ({
    user_id: userId,
    name: day.name,
    day_order: index + 1,
    is_rest_day: day.isRest,
  }));

  const { error: insertError } = await supabase
    .from("training_split")
    .insert(rows);

  if (insertError) throw insertError;
}

/** Loads the user's saved split, ordered Mon → Sun. Empty if none set yet. */
export async function fetchTrainingSplit(): Promise<SplitDay[]> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("training_split")
    .select("name, is_rest_day, day_order")
    .eq("user_id", userId)
    .order("day_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    name: row.name as string,
    isRest: Boolean(row.is_rest_day),
  }));
}

/** An editable day in the customize-days editor: a name, a rest flag, and an
 * optional activity note when resting. */
export interface EditableDay {
  name: string;
  isRest: boolean;
  restActivity?: string | null;
}

/** A saved split row with its id — needed by pick-exercises to attach picks. */
export interface TrainingSplitRow extends EditableDay {
  id: string;
  dayOrder: number;
}

/** Loads the saved split rows with their ids, ordered by day_order. */
export async function fetchTrainingSplitRows(): Promise<TrainingSplitRow[]> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("training_split")
    .select("id, name, is_rest_day, rest_activity, day_order")
    .eq("user_id", userId)
    .order("day_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    isRest: Boolean(row.is_rest_day),
    restActivity: (row.rest_activity as string | null) ?? null,
    dayOrder: row.day_order as number,
  }));
}

/**
 * Rewrites the user's split from the customize-days editor. Like
 * `saveTrainingSplit`, it deletes then re-inserts (a split is many rows), but
 * it stores the editor's `restActivity` note and preserves the editor order via
 * `day_order`. Returns the freshly-inserted rows (with new ids) so the caller
 * can hand them straight to the exercise picker.
 */
export async function saveTrainingSplitDays(
  days: EditableDay[]
): Promise<TrainingSplitRow[]> {
  const userId = await ensureAnonymousSession();

  const { error: deleteError } = await supabase
    .from("training_split")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  const rows = days.map((day, index) => ({
    user_id: userId,
    name: day.name,
    day_order: index + 1,
    is_rest_day: day.isRest,
    rest_activity: day.isRest ? day.restActivity ?? null : null,
  }));

  const { data, error: insertError } = await supabase
    .from("training_split")
    .insert(rows)
    .select("id, name, is_rest_day, rest_activity, day_order")
    .order("day_order", { ascending: true });

  if (insertError) throw insertError;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    isRest: Boolean(row.is_rest_day),
    restActivity: (row.rest_activity as string | null) ?? null,
    dayOrder: row.day_order as number,
  }));
}
