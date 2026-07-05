/**
 * Progressive-overload maths for the session logging screen. Pure — no React,
 * no Supabase — so the "what should I lift today" rule can be reasoned about and
 * unit-checked in isolation, the way `schedule.ts` keeps the day-index maths.
 *
 * The rule the screen applies to each prescribed set:
 *   • no history yet          → no suggestion (the user types their own start)
 *   • all reps hit last time  → add a step (+2.5kg compound, +1.25kg isolation)
 *   • reps missed last time   → hold the same weight and try to complete it
 *   • deload session          → drop to 60% of last weight regardless
 */

/** The step added when last session's target reps were all met. */
export const COMPOUND_STEP_KG = 2.5;
export const ISOLATION_STEP_KG = 1.25;

/** Deload sessions back off to this fraction of the last logged weight. */
export const DELOAD_FRACTION = 0.6;

/**
 * Compound (multi-joint) lifts progress in bigger jumps than isolation work.
 * We key off the exercise's library `tier`: "Accessory" rows are the isolation
 * movements, everything else (Primary / Secondary) is treated as a compound.
 */
export function isCompoundTier(tier: string | null | undefined): boolean {
  return (tier ?? "").trim().toLowerCase() !== "accessory";
}

/** Weights round to the nearest 0.25kg so suggestions land on real plate maths. */
function roundWeight(kg: number): number {
  return Math.round(kg * 4) / 4;
}

/** What we know about an exercise's most recent completed session. */
export interface LastSessionStat {
  /** Reference weight carried forward — the top set of that session. Null if none. */
  weight: number | null;
  /** True when every logged set that session met or beat its target reps. */
  allRepsHit: boolean;
}

export interface SuggestInput {
  last: LastSessionStat;
  isCompound: boolean;
  deload: boolean;
}

/**
 * The weight to pre-fill a set with. Null means "no history" — the row shows a
 * blank/placeholder and the user enters their own starting load.
 */
export function suggestWeight({ last, isCompound, deload }: SuggestInput): number | null {
  if (last.weight == null) return null;

  if (deload) return roundWeight(last.weight * DELOAD_FRACTION);

  if (last.allRepsHit) {
    const step = isCompound ? COMPOUND_STEP_KG : ISOLATION_STEP_KG;
    return roundWeight(last.weight + step);
  }

  return roundWeight(last.weight);
}

/** Trims trailing zeros so 42.5 → "42.5" and 40.0 → "40" for display. */
export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return Number(kg.toFixed(2)).toString();
}

const ROMAN_ONES = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"];
const ROMAN_TENS = ["", "x", "xx", "xxx", "xl", "l"];

/**
 * Lowercase roman numeral for a 1-based set index ("i", "ii", "iii", "iv" …).
 * Covers 1–59, far past any realistic set count; falls back to the number.
 */
export function toRoman(n: number): string {
  if (n < 1 || n > 59) return String(n);
  return ROMAN_TENS[Math.floor(n / 10)] + ROMAN_ONES[n % 10];
}
