import type { TrainingAnswers } from "@/lib/onboarding/training/answers";

export type Patch = (partial: Partial<TrainingAnswers>) => void;

/** Props every wizard step answer-area receives from the controller. */
export interface StepProps {
  answers: TrainingAnswers;
  patch: Patch;
}
