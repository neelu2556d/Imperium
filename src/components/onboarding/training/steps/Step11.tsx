"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";

const OPTIONS: { title: string; subtitle: string }[] = [
  { title: "Full commercial gym", subtitle: "racks, machines, cables, the works" },
  { title: "Home gym", subtitle: "barbell, plates, rack" },
  { title: "Dumbbells only", subtitle: "plus maybe a bench" },
  { title: "Bodyweight + bands", subtitle: "no free weights" },
  { title: "It varies", subtitle: "gym some days, home others" },
];

export default function Step11({ answers, patch }: StepProps) {
  const value = answers.equipment_access;
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.title}
          title={o.title}
          subtitle={o.subtitle}
          italicTitle
          selected={value === o.title}
          onSelect={() => patch({ equipment_access: o.title })}
        />
      ))}
    </div>
  );
}
