"use client";

import ValueSlider from "@/components/onboarding/training/primitives/ValueSlider";
import type { StepProps } from "@/components/onboarding/training/types";

const DESCRIPTORS: Record<number, string> = {
  2: "getting started",
  3: "building momentum",
  4: "committed",
  5: "dedicated",
  6: "all in",
};

export default function Step09({ answers, patch }: StepProps) {
  return (
    <ValueSlider
      min={2}
      max={6}
      step={1}
      fallback={4}
      value={answers.training_days_per_week}
      onChange={(v) => patch({ training_days_per_week: v })}
      display={(v) => `${v}`}
      caption="DAYS A WEEK"
      descriptor={(v) => DESCRIPTORS[v] ?? ""}
    />
  );
}
