"use client";

import EnergyBars, {
  type EnergyOption,
} from "@/components/onboarding/training/primitives/EnergyBars";
import TrainingIcon from "@/components/onboarding/training/primitives/TrainingIcon";
import type { StepProps } from "@/components/onboarding/training/types";

const OPTIONS: EnergyOption[] = [
  { value: "Rough", label: "Rough" },
  { value: "Stressed", label: "Stressed" },
  { value: "Okay", label: "Okay" },
  { value: "Great", label: "Great" },
];

export default function Step03({ answers, patch }: StepProps) {
  return (
    <div>
      <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-strong">
        <span style={{ color: "var(--color-mint)" }}>
          <TrainingIcon name="bolt" size={16} />
        </span>
        How charged do you feel?
      </p>
      <EnergyBars
        options={OPTIONS}
        value={answers.recovery_level}
        onChange={(v) => patch({ recovery_level: v })}
      />
    </div>
  );
}
