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
