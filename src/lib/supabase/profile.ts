import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import {
  STEP_FIELDS,
  type TrainingAnswers,
  type TrainingField,
} from "@/lib/onboarding/training/answers";

/**
 * Loads the current user's first name. Returns null for brand-new users who
 * haven't set a profile row yet, so callers can fall back to a generic
 * greeting.
 */
export async function getFirstName(): Promise<string | null> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data?.first_name ?? null;
}

export interface ProfileBasics {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Persists the "About you" onboarding answers, upserting the single profile
 * row for the current user. Height/weight are always stored in metric no
 * matter which unit the user typed in — the UI converts before calling this.
 */
export async function saveProfileBasics(basics: ProfileBasics): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      name: basics.name,
      age: basics.age,
      height_cm: basics.heightCm,
      weight_kg: basics.weightKg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

/** Loads any training-quiz answers already saved for the current user. */
export async function fetchTrainingAnswers(): Promise<TrainingAnswers> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select(STEP_FIELDS.join(", "))
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return {};

  const row = data as unknown as Record<string, unknown>;
  const answers: TrainingAnswers = {};
  for (const field of STEP_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined) {
      Object.assign(answers, { [field]: value });
    }
  }
  return answers;
}

/**
 * Upserts a single training-quiz answer onto the user's profile row. Called as
 * the user advances through the wizard so progress survives a mid-flow exit.
 */
export async function saveTrainingAnswer(
  field: TrainingField,
  value: string | number | string[]
): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      [field]: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

export interface BodyStats {
  heightCm: number | null;
  weightKg: number | null;
}

/** Loads the user's height/weight so callers can tell if the basics are set. */
export async function fetchBodyStats(): Promise<BodyStats> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("height_cm, weight_kg")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    heightCm: data?.height_cm ?? null,
    weightKg: data?.weight_kg ?? null,
  };
}

export interface MentorSetup {
  tone: string | null;
  focus: string[];
}

/** Loads any saved mentor personality settings, for prefill on return. */
export async function fetchMentorSetup(): Promise<MentorSetup> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("mentor_tone, mentor_focus")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    tone: data?.mentor_tone ?? null,
    focus: (data?.mentor_focus ?? []) as string[],
  };
}

/** Upserts the user's mentor tone + focus areas onto their profile row. */
export async function saveMentorSetup(
  tone: string,
  focus: string[]
): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      mentor_tone: tone,
      mentor_focus: focus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
