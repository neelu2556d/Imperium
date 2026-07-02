/**
 * Shape + persistence helpers for the /onboarding/training quiz. Answers are
 * mirrored: written through to localStorage on every change for instant,
 * offline-safe restore, and upserted to the profiles table on continue as the
 * durable, cross-device source of truth. Field names match profiles columns
 * 1:1 so mapping to/from Supabase is the identity function.
 */

export interface TrainingAnswers {
  training_experience?: string; // step 1
  barbell_confidence?: string; // step 2
  recovery_level?: string; // step 3
  headline_goal?: string; // step 4
  body_bias?: string[]; // step 5
  preferred_split?: string; // step 6
  equipment_preference?: string; // step 7
  rpe_style?: string; // step 8
  training_days_per_week?: number; // step 9
  session_duration_min?: number; // step 10
  equipment_access?: string; // step 11
  movement_limitations?: string[]; // step 12
  lifestyle_activity?: string; // step 13
}

export type TrainingField = keyof TrainingAnswers;

/** Field collected on each wizard step, in flow order (index 0 => step 1). */
export const STEP_FIELDS: TrainingField[] = [
  "training_experience",
  "barbell_confidence",
  "recovery_level",
  "headline_goal",
  "body_bias",
  "preferred_split",
  "equipment_preference",
  "rpe_style",
  "training_days_per_week",
  "session_duration_min",
  "equipment_access",
  "movement_limitations",
  "lifestyle_activity",
];

export const TOTAL_STEPS = STEP_FIELDS.length; // 13

export function isFieldAnswered(
  answers: TrainingAnswers,
  field: TrainingField
): boolean {
  const value = answers[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The step the user should land on when resuming: the first unanswered step,
 * or the final step if everything is already filled in. Always clamped to the
 * valid 1..TOTAL_STEPS range.
 */
export function resumeStep(answers: TrainingAnswers): number {
  for (let i = 0; i < STEP_FIELDS.length; i++) {
    if (!isFieldAnswered(answers, STEP_FIELDS[i])) return i + 1;
  }
  return TOTAL_STEPS;
}

const STORAGE_KEY = "imperium.onboarding.training";

export function readLocalAnswers(): TrainingAnswers {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrainingAnswers) : {};
  } catch {
    return {};
  }
}

export function writeLocalAnswers(answers: TrainingAnswers): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // Ignore quota / private-mode errors — Supabase stays the source of truth.
  }
}

export function clearLocalAnswers(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Overlays locally-held answers on top of the remote row. Local values win,
 * because they may include edits made offline that haven't been upserted yet.
 */
export function mergeAnswers(
  remote: TrainingAnswers,
  local: TrainingAnswers
): TrainingAnswers {
  const merged: TrainingAnswers = { ...remote };
  for (const field of Object.keys(local) as TrainingField[]) {
    if (isFieldAnswered(local, field)) {
      Object.assign(merged, { [field]: local[field] });
    }
  }
  return merged;
}
