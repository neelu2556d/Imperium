"use client";

import TrainingIcon, {
  type IconName,
} from "@/components/onboarding/training/primitives/TrainingIcon";

export interface NodeOption {
  value: string;
  label: string;
  icon: IconName;
  description: string;
}

interface IconNodeSliderProps {
  options: NodeOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * Horizontal icon slider: nodes strung along a line, an icon above each and a
 * label below. Tapping a node fills it mint and reveals its description beneath
 * the track.
 */
export default function IconNodeSlider({
  options,
  value,
  onChange,
}: IconNodeSliderProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <div className="relative flex items-start justify-between">
        {/* connecting line behind the nodes */}
        <div
          className="absolute left-0 right-0 top-[34px] h-px"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden="true"
        />

        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              data-no-vitality
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className="relative z-10 flex flex-1 flex-col items-center gap-2"
            >
              <span
                className="transition-colors"
                style={{
                  color: isSelected
                    ? "var(--color-mint)"
                    : "var(--color-muted)",
                }}
              >
                <TrainingIcon name={option.icon} size={22} />
              </span>
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors"
                style={{
                  borderColor: isSelected
                    ? "var(--color-mint)"
                    : "var(--color-border-strong)",
                  background: isSelected
                    ? "var(--color-mint)"
                    : "var(--color-bg)",
                  boxShadow: isSelected
                    ? "0 0 0 4px var(--color-mint-glow)"
                    : "none",
                }}
              />
              <span
                className="max-w-[4.5rem] text-center text-[0.72rem] leading-tight transition-colors"
                style={{
                  color: isSelected
                    ? "var(--color-fg)"
                    : "var(--color-muted)",
                }}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="mt-7 min-h-[3rem] rounded-lg border p-4 text-center text-sm transition-colors"
        style={{
          borderColor: selected
            ? "var(--color-mint)"
            : "var(--color-border)",
          background: "var(--color-card)",
          color: selected ? "var(--color-fg)" : "var(--color-muted)",
        }}
        aria-live="polite"
      >
        {selected ? selected.description : "Tap where you're at."}
      </div>
    </div>
  );
}
