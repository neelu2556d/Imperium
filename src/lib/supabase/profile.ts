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

export interface ProfileBasicsValues {
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

/** Loads the full "About you" set for prefilling the settings profile form. */
export async function fetchProfileBasics(): Promise<ProfileBasicsValues> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("name, first_name, age, height_cm, weight_kg")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    name: (data?.name as string) ?? (data?.first_name as string) ?? "",
    age: data?.age ?? null,
    heightCm: data?.height_cm ?? null,
    weightKg: data?.weight_kg ?? null,
  };
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

/** The four accent themes the settings switcher offers. */
export type ThemePreference = "mint" | "blue" | "red" | "gold";

export const DEFAULT_THEME: ThemePreference = "mint";

const THEMES: ThemePreference[] = ["mint", "blue", "red", "gold"];

/** Narrows an arbitrary value to a known theme, falling back to the default. */
export function normalizeTheme(value: unknown): ThemePreference {
  return THEMES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME;
}

/**
 * Loads the user's saved accent theme. Returns the default for brand-new users
 * with no profile row yet, so the app always has a concrete theme to apply.
 */
export async function fetchThemePreference(): Promise<ThemePreference> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return normalizeTheme(data?.theme_preference);
}

/** Upserts the user's accent theme choice onto their profile row. */
export async function saveThemePreference(
  theme: ThemePreference
): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      theme_preference: theme,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
