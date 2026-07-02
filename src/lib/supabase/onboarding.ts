import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import {
  getFirstStep,
  getNextStep,
  type OnboardingStepId,
} from "@/lib/onboarding/steps";
import type { OnboardingState } from "@/lib/onboarding/types";

interface OnboardingRow {
  current_step: string;
  completed_steps: string[];
  is_complete: boolean;
}

function rowToState(row: OnboardingRow): OnboardingState {
  return {
    currentStep: row.current_step as OnboardingStepId,
    completedSteps: row.completed_steps as OnboardingStepId[],
    isComplete: row.is_complete,
  };
}

/**
 * Loads onboarding state for the current user, creating a fresh row (at the
 * first step) if none exists yet. Always ensures an anonymous session first.
 */
export async function getOnboardingState(): Promise<OnboardingState> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("user_onboarding")
    .select("current_step, completed_steps, is_complete")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return rowToState(data);
  }

  const firstStep = getFirstStep();
  const { data: created, error: insertError } = await supabase
    .from("user_onboarding")
    .insert({ user_id: userId, current_step: firstStep })
    .select("current_step, completed_steps, is_complete")
    .single();

  if (insertError) throw insertError;

  return rowToState(created);
}

/**
 * Marks `step` as completed and advances `current_step` to the next step in
 * the registry (or leaves it unchanged if `step` is already the last one).
 */
export async function advanceOnboardingStep(
  step: OnboardingStepId,
  completedSteps: OnboardingStepId[]
): Promise<OnboardingState> {
  const userId = await ensureAnonymousSession();
  const nextStep = getNextStep(step) ?? step;
  const nextCompleted = completedSteps.includes(step)
    ? completedSteps
    : [...completedSteps, step];

  const { data, error } = await supabase
    .from("user_onboarding")
    .update({
      current_step: nextStep,
      completed_steps: nextCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("current_step, completed_steps, is_complete")
    .single();

  if (error) throw error;

  return rowToState(data);
}

export async function completeOnboarding(): Promise<OnboardingState> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("user_onboarding")
    .update({
      is_complete: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("current_step, completed_steps, is_complete")
    .single();

  if (error) throw error;

  return rowToState(data);
}

/**
 * Appends a step id to completed_steps without touching current_step. Used by
 * hub-style setup sub-screens (e.g. 'macros') that return to /onboarding/setup
 * instead of advancing the linear flow. Idempotent.
 */
export async function markStepComplete(step: string): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("user_onboarding")
    .select("completed_steps")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const current = (data?.completed_steps ?? []) as string[];
  if (current.includes(step)) return;

  const { error: updateError } = await supabase
    .from("user_onboarding")
    .update({
      completed_steps: [...current, step],
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) throw updateError;
}

/** Explicit user-triggered reset — the only way onboarding is shown again. */
export async function resetOnboarding(): Promise<OnboardingState> {
  const userId = await ensureAnonymousSession();
  const firstStep = getFirstStep();

  const { data, error } = await supabase
    .from("user_onboarding")
    .update({
      current_step: firstStep,
      completed_steps: [],
      is_complete: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("current_step, completed_steps, is_complete")
    .single();

  if (error) throw error;

  return rowToState(data);
}
