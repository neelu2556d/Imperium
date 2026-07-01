import type { OnboardingStepId } from "./steps";

export type { OnboardingStepId };

export interface OnboardingState {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  isComplete: boolean;
}
