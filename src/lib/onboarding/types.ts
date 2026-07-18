import type { OnboardingStepId } from "./steps";

export type { OnboardingStepId };

export interface OnboardingState {
  currentStep: OnboardingStepId;
  /**
   * Step ids the user has finished. Besides registry steps this can hold
   * hub sub-screen ids (e.g. 'macros', 'mentor') written via
   * `markStepComplete`, so it's wider than OnboardingStepId.
   */
  completedSteps: string[];
  isComplete: boolean;
}
