"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";
import type { IconName } from "@/components/onboarding/training/primitives/TrainingIcon";

const OPTIONS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "One body part a day", subtitle: "chest day, back day, leg day. Bro Split territory", icon: "calendar" },
  { title: "Push, pull, legs", subtitle: "movement-pattern days, classic PPL", icon: "layers" },
  { title: "Upper / lower", subtitle: "one day up top, next day legs", icon: "split" },
  { title: "Everything every session", subtitle: "full body each visit", icon: "orbit" },
  { title: "Pick whatever fits best", subtitle: "I trust the engine", icon: "sparkles" },
];

export default function Step06({ answers, patch }: StepProps) {
  const value = answers.preferred_split;
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.title}
          title={o.title}
          subtitle={o.subtitle}
          icon={o.icon}
          selected={value === o.title}
          onSelect={() => patch({ preferred_split: o.title })}
        />
      ))}
    </div>
  );
}
