"use client";

export interface EnergyOption {
  value: string;
  label: string;
}

interface EnergyBarsProps {
  options: EnergyOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * Four bars that grow taller left-to-right to visualise rising energy. Tapping
 * one fills it mint. Heights are derived from position so any 4-option set
 * reads as a gradient from "rough" to "great".
 */
export default function EnergyBars({
  options,
  value,
  onChange,
}: EnergyBarsProps) {
  return (
    <div className="flex items-end justify-between gap-3" style={{ height: 220 }}>
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const heightPct = 40 + (index / (options.length - 1)) * 60; // 40% → 100%
        return (
          <button
            key={option.value}
            type="button"
            data-no-vitality
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className="flex flex-1 flex-col items-center justify-end rounded-xl border pb-3 pt-2 transition-colors"
            style={{
              height: `${heightPct}%`,
              borderColor: isSelected
                ? "var(--color-mint)"
                : "var(--color-border)",
              background: isSelected
                ? "rgb(var(--accent-rgb) / 0.12)"
                : "var(--color-card-elevated)",
              color: isSelected ? "var(--color-mint)" : "var(--color-muted-strong)",
            }}
          >
            <span className="text-sm font-semibold">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
