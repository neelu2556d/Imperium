import type { ComponentType } from "react";
import WelcomeStep from "@/components/onboarding/steps/WelcomeStep";

/**
 * Single source of truth for onboarding screen order. To add a screen:
 * 1. Add its id here (order = flow order).
 * 2. Add its component to STEP_COMPONENTS below.
 * No routing or persistence code needs to change.
 */
export const ONBOARDING_STEPS = ["welcome"] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const STEP_COMPONENTS: Record<OnboardingStepId, ComponentType> = {
  welcome: WelcomeStep,
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
