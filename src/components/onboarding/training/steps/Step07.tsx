"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import type { StepProps } from "@/components/onboarding/training/types";
import type { IconName } from "@/components/onboarding/training/primitives/TrainingIcon";

const OPTIONS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "Barbell", subtitle: "give me the bar", icon: "barbell" },
  { title: "Dumbbells", subtitle: "feels best on my body", icon: "dumbbell" },
  { title: "Machines", subtitle: "locked-in, dialed-in", icon: "cog" },
  { title: "Cables and isolation", subtitle: "full ROM, constant tension", icon: "cable" },
  { title: "Mix it all", subtitle: "no strong preference", icon: "shuffle" },
];

export default function Step07({ answers, patch }: StepProps) {
  const value = answers.equipment_preference;
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((o, i) => {
        const spanFull = i === OPTIONS.length - 1 && OPTIONS.length % 2 === 1;
        return (
          <div key={o.title} className={spanFull ? "col-span-2" : ""}>
            <ChoiceCard
              title={o.title}
              subtitle={o.subtitle}
              icon={o.icon}
              selected={value === o.title}
              onSelect={() => patch({ equipment_preference: o.title })}
            />
          </div>
        );
      })}
    </div>
  );
}
