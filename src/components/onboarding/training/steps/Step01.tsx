"use client";

import IconNodeSlider, {
  type NodeOption,
} from "@/components/onboarding/training/primitives/IconNodeSlider";
import type { StepProps } from "@/components/onboarding/training/types";

const OPTIONS: NodeOption[] = [
  { value: "New", label: "New", icon: "sprout", description: "Fresh to lifting, or close to it." },
  { value: "A few years", label: "A few years", icon: "calendar", description: "A couple of years of steady work." },
  { value: "Seasoned", label: "Seasoned", icon: "flame", description: "Three years plus under the bar." },
  { value: "Coming back", label: "Coming back", icon: "rotate-back", description: "Trained before, returning after time off." },
  { value: "Starting over", label: "Starting over", icon: "refresh", description: "Rebuilding from a long layoff." },
];

export default function Step01({ answers, patch }: StepProps) {
  return (
    <IconNodeSlider
      options={OPTIONS}
      value={answers.training_experience}
      onChange={(v) => patch({ training_experience: v })}
    />
  );
}
