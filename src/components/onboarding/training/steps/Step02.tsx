"use client";

import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import LiftCue from "@/components/onboarding/training/primitives/LiftCue";
import type { StepProps } from "@/components/onboarding/training/types";
import type { IconName } from "@/components/onboarding/training/primitives/TrainingIcon";

const OPTIONS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "Rock solid", subtitle: "squat, bench, deadlift feel like home", icon: "shield-check" },
  { title: "Getting there", subtitle: "I can do them, still tuning form", icon: "trending-up" },
  { title: "Still learning", subtitle: "rather not load them heavy yet", icon: "book" },
  { title: "I don't use them", subtitle: "give me machines and dumbbells", icon: "sliders" },
];

export default function Step02({ answers, patch }: StepProps) {
  const value = answers.barbell_confidence;
  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        <LiftCue word="Squat" cue="Brace hard, sit between your hips, drive the floor away." />,{" "}
        <LiftCue word="bench" cue="Shoulder blades pinned, bar to mid-chest, press up and back." />,{" "}
        <LiftCue word="deadlift" cue="Flat back, push the floor away, keep the bar close to you." />
        . Tap any to see it. New to them is totally fine.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.title}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
            selected={value === o.title}
            onSelect={() => patch({ barbell_confidence: o.title })}
          />
        ))}
      </div>
    </div>
  );
}
