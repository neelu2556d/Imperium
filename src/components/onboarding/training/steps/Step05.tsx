"use client";

import BodyMap, {
  type BodyRegion,
} from "@/components/onboarding/training/primitives/BodyMap";
import Chip from "@/components/onboarding/training/primitives/Chip";
import type { StepProps } from "@/components/onboarding/training/types";

const BALANCED = "Balanced";
const MUSCLES: BodyRegion[] = [
  "Chest",
  "Back / lats",
  "Shoulders / delts",
  "Arms (bi/tri)",
  "Legs / glutes",
];
const MAX_PICKS = 2;

export default function Step05({ answers, patch }: StepProps) {
  const selected = answers.body_bias ?? [];
  const muscles = selected.filter((v) => v !== BALANCED);
  const atCap = muscles.length >= MAX_PICKS;

  const toggle = (value: string) => {
    if (value === BALANCED) {
      patch({ body_bias: selected.includes(BALANCED) ? [] : [BALANCED] });
      return;
    }
    const base = selected.filter((v) => v !== BALANCED);
    if (base.includes(value)) {
      patch({ body_bias: base.filter((v) => v !== value) });
    } else if (base.length < MAX_PICKS) {
      patch({ body_bias: [...base, value] });
    }
  };

  const disabledRegions = new Set(
    atCap ? MUSCLES.filter((m) => !muscles.includes(m)) : []
  );

  return (
    <div className="flex items-start gap-4">
      <BodyMap selected={muscles} onToggle={toggle} disabledRegions={disabledRegions} />

      <div className="flex flex-1 flex-col gap-2">
        <Chip
          label={BALANCED}
          icon="plus"
          selected={selected.includes(BALANCED)}
          onToggle={() => toggle(BALANCED)}
        />
        {MUSCLES.map((m) => {
          const isSelected = muscles.includes(m);
          return (
            <Chip
              key={m}
              label={m}
              selected={isSelected}
              disabled={atCap && !isSelected}
              onToggle={() => toggle(m)}
            />
          );
        })}
      </div>
    </div>
  );
}
