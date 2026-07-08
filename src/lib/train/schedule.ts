/**
 * Pure scheduling helpers for the /train dashboard. Kept free of React and
 * Supabase so the "which day is today" maths can be reasoned about in isolation.
 * The dashboard feeds these the user's FIRST logged session date (the anchor the
 * split cycles from) and their local `new Date()` so the highlighted card
 * reflects their wall clock. Before anything is logged the dashboard defaults to
 * day 1 without calling these.
 */

/**
 * Whole calendar days between two dates, counted at local midnight so a session
 * that started late last night and one this morning are exactly one day apart
 * regardless of clock time. Negative if `to` precedes `from`.
 */
export function daysSince(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Index of "today" within a split of `splitLength` days: the user cycles
 * through the split in order from their start date, so day N since creation
 * lands on `N mod length`. Guards against an empty split and pre-creation dates.
 */
export function todayIndexInSplit(
  createdAt: Date,
  today: Date,
  splitLength: number
): number {
  if (splitLength <= 0) return 0;
  const elapsed = daysSince(createdAt, today);
  return ((elapsed % splitLength) + splitLength) % splitLength;
}
