"use client";

import Chip from "@/components/onboarding/training/primitives/Chip";
import type { StepProps } from "@/components/onboarding/training/types";

const NOTHING = "Nothing";
const LIMITATIONS = [
  "Heavy squatting",
  "Heavy deadlifting",
  "Overhead pressing",
  "Heavy pulling",
  "Jumping / explosive",
  "Bench pressing",
  "Lower-back loading",
];

export default function Step12({ answers, patch }: StepProps) {
  const selected = answers.movement_limitations ?? [];

  const toggle = (value: string) => {
    if (value === NOTHING) {
      patch({ movement_limitations: selected.includes(NOTHING) ? [] : [NOTHING] });
      return;
    }
    const base = selected.filter((v) => v !== NOTHING);
    patch({
      movement_limitations: base.includes(value)
        ? base.filter((v) => v !== value)
        : [...base, value],
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        label={NOTHING}
        checkOnSelect
        selected={selected.includes(NOTHING)}
        onToggle={() => toggle(NOTHING)}
      />
      {LIMITATIONS.map((l) => (
        <Chip
          key={l}
          label={l}
          checkOnSelect
          selected={selected.includes(l)}
          onToggle={() => toggle(l)}
        />
      ))}
    </div>
  );
}
