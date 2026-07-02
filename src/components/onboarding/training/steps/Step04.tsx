"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";
import type { IconName } from "@/components/onboarding/training/primitives/TrainingIcon";

const OPTIONS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "Get stronger", subtitle: "heavier compounds, less about size", icon: "barbell" },
  { title: "Build muscle", subtitle: "size, shape, aesthetics", icon: "muscle" },
  { title: "Lose fat", subtitle: "cut, lean down", icon: "flame" },
  { title: "Recomp", subtitle: "lose fat + add muscle at the same time", icon: "recomp" },
  { title: "Stay healthy", subtitle: "general fitness, longevity", icon: "heart" },
];

export default function Step04({ answers, patch }: StepProps) {
  const value = answers.headline_goal;
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.title}
          title={o.title}
          subtitle={o.subtitle}
          icon={o.icon}
          checkBadge
          selected={value === o.title}
          onSelect={() => patch({ headline_goal: o.title })}
        />
      ))}
    </div>
  );
}
