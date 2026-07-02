"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";
import type { IconName } from "@/components/onboarding/training/primitives/TrainingIcon";

const OPTIONS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "Mostly desk life", subtitle: "lifting is the workout", icon: "desk" },
  { title: "Walks and casual movement", subtitle: "active but not training", icon: "walk" },
  { title: "A sport", subtitle: "BJJ, soccer, climbing, anything", icon: "sport" },
  { title: "Regular runs", subtitle: "three or more runs a week", icon: "run" },
  { title: "Cycling, rowing, low-impact cardio", subtitle: "knee-friendly cardio", icon: "bike" },
  { title: "Cardio is the main thing", subtitle: "lifting supports cardio", icon: "pulse" },
];

export default function Step13({ answers, patch }: StepProps) {
  const value = answers.lifestyle_activity;
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.title}
          title={o.title}
          subtitle={o.subtitle}
          icon={o.icon}
          selected={value === o.title}
          onSelect={() => patch({ lifestyle_activity: o.title })}
        />
      ))}
    </div>
  );
}
