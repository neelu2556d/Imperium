"use client";

import ValueSlider from "@/components/onboarding/training/primitives/ValueSlider";
import type { StepProps } from "@/components/onboarding/training/types";

function descriptor(v: number): string {
  if (v <= 30) return "tight window";
  if (v === 45) return "focused";
  if (v === 60) return "solid session";
  if (v <= 90) return "in the zone";
  return "no rush";
}

export default function Step10({ answers, patch }: StepProps) {
  return (
    <ValueSlider
      min={30}
      max={120}
      step={15}
      fallback={60}
      value={answers.session_duration_min}
      onChange={(v) => patch({ session_duration_min: v })}
      display={(v) => `${v} MIN`}
      caption="PER SESSION"
      descriptor={descriptor}
    />
  );
}
