"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";

const OPTIONS: { title: string; subtitle: string }[] = [
  { title: "At absolute failure", subtitle: "every set to count" },
  { title: "One or two left in the tank", subtitle: "clean grindy reps" },
  { title: "Three-ish left", subtitle: "quality reps only, never grinding" },
  { title: "It depends on the lift", subtitle: "hard on isolations, controlled on compounds" },
];

export default function Step08({ answers, patch }: StepProps) {
  const value = answers.rpe_style;
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.title}
          title={o.title}
          subtitle={o.subtitle}
          selected={value === o.title}
          onSelect={() => patch({ rpe_style: o.title })}
        />
      ))}
    </div>
  );
}
