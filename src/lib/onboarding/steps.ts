import type { ComponentType } from "react";
import AboutStep from "@/components/onboarding/steps/AboutStep";
import SetupStep from "@/components/onboarding/steps/SetupStep";
import TrainingStep from "@/components/onboarding/steps/TrainingStep";
import SplitStep from "@/components/onboarding/steps/SplitStep";

/**
 * Single source of truth for onboarding screen order. To add a screen:
 * 1. Add its id here (order = flow order).
 * 2. Add its component to STEP_COMPONENTS below.
 * No routing or persistence code needs to change.
 *
 * Note: 'training' renders as a self-contained nested wizard at
 * /onboarding/training/[step]; its registry entry only wires up
 * current_step / completed_steps tracking.
 */
export const ONBOARDING_STEPS = ["about", "setup", "training", "split"] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const STEP_COMPONENTS: Record<OnboardingStepId, ComponentType> = {
  about: AboutStep,
  setup: SetupStep,
  training: TrainingStep,
  split: SplitStep,
};

export function isOnboardingStepId(value: string): value is OnboardingStepId {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function getFirstStep(): OnboardingStepId {
  return ONBOARDING_STEPS[0];
}

export function getNextStep(
  step: OnboardingStepId
): OnboardingStepId | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export function getStepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEPS.indexOf(step);
}
