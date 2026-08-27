"use client";

/**
 * Train-tab client settings + pure helpers. Settings (weight unit, rest-timer
 * length, default sets/reps) live in localStorage — there's no settings table
 * in the schema — behind a tiny typed accessor. Also holds the unit-conversion
 * and 1RM maths shared across the workout screens.
 */

export type WeightUnit = "kg" | "lbs";

export interface TrainSettings {
  unit: WeightUnit;
  restSeconds: number;
  defaultSets: number;
  defaultReps: number;
}

export const DEFAULT_TRAIN_SETTINGS: TrainSettings = {
  unit: "kg",
  restSeconds: 90,
  defaultSets: 3,
  defaultReps: 8,
};

const KEY = "imperium.train.settings";

/** Reads the saved settings, merged over defaults (SSR-safe → defaults). */
export function getTrainSettings(): TrainSettings {
  if (typeof window === "undefined") return DEFAULT_TRAIN_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TRAIN_SETTINGS;
    return { ...DEFAULT_TRAIN_SETTINGS, ...(JSON.parse(raw) as Partial<TrainSettings>) };
  } catch {
    return DEFAULT_TRAIN_SETTINGS;
  }
}

/** Persists settings (partial merge over current). */
export function saveTrainSettings(patch: Partial<TrainSettings>): TrainSettings {
  const next = { ...getTrainSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota / disabled storage
  }
  return next;
}

const LBS_PER_KG = 2.2046226218;

/** Converts a stored kg value to the display unit. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === "lbs" ? kg * LBS_PER_KG : kg;
}

/** Converts a user-entered display value back to kg for storage. */
export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? value / LBS_PER_KG : value;
}

/** Epley estimated 1-rep-max: weight × (1 + reps/30). Reps=1 → weight. */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/** "1h 12m", "48m", or "0m" from a seconds count. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** "M:SS" clock for the rest timer. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
