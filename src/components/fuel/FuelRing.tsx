"use client";

/**
 * The Fuel tab's hero ring. The circle is split into three equal arcs — one
 * per macro — and each arc fills from its start toward that macro's goal
 * (capped at 100%). Protein is mint, carbs amber, fat a muted white-grey,
 * matching the stat pills below it. The centre shows today's total calories
 * over the day's calorie goal. Everything transitions smoothly, so the ring
 * animates live as meals are logged.
 */

export const PROTEIN_COLOR = "var(--color-mint)";
export const CARBS_COLOR = "var(--color-amber)";
export const FAT_COLOR = "rgba(255, 255, 255, 0.55)";

interface Macro {
  logged: number;
  goal: number;
  color: string;
}

interface FuelRingProps {
  calories: number;
  goalCalories: number;
  protein: Macro;
  carbs: Macro;
  fat: Macro;
  size?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export default function FuelRing({
  calories,
  goalCalories,
  protein,
  carbs,
  fat,
  size = 220,
}: FuelRingProps) {
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const macros = [protein, carbs, fat];

  // Each macro owns a third of the circle, separated by a small visual gap.
  const gap = circumference * 0.03;
  const segment = circumference / 3;
  const arcLen = segment - gap;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Macro progress toward today's goals"
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          {macros.map((m, i) => {
            const offset = i * segment;
            const frac = m.goal > 0 ? clamp01(m.logged / m.goal) : 0;
            const fillLen = arcLen * frac;
            return (
              <g key={i}>
                {/* track — the macro's colour, dimmed */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={m.color}
                  strokeOpacity={0.16}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${arcLen} ${circumference - arcLen}`}
                  strokeDashoffset={-offset}
                />
                {/* fill — proportional to logged / goal */}
                {fillLen > 0 && (
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${fillLen} ${circumference - fillLen}`}
                    strokeDashoffset={-offset}
                    style={{
                      transition:
                        "stroke-dasharray 450ms var(--ease-premium)",
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono text-4xl font-semibold leading-none tabular-nums">
          {Math.round(calories)}
        </span>
        <span className="mono mt-1.5 text-[0.72rem] tracking-[0.04em] text-muted">
          / {Math.round(goalCalories)} kcal
        </span>
      </div>
    </div>
  );
}
