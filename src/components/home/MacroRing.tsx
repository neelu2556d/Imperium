interface MacroRingProps {
  /** Calories logged today. */
  calories: number;
  /** Daily calorie goal — the ring fills toward this. */
  goalCalories: number;
  size?: number;
}

/**
 * Compact calorie-progress donut for the Fuel card. A single mint arc fills
 * from 0 toward the day's goal; the centre shows today's calorie total in mono.
 * Distinct from the onboarding MacroDonut, which is a large 3-segment target
 * ring — this one is a small single-value progress ring.
 */
export default function MacroRing({
  calories,
  goalCalories,
  size = 60,
}: MacroRingProps) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const fraction =
    goalCalories > 0 ? Math.max(0, Math.min(1, calories / goalCalories)) : 0;
  const dash = fraction * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{
              transition: "stroke-dasharray 400ms var(--ease-DEFAULT)",
            }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="mono text-[0.72rem] font-semibold leading-none">
          {Math.round(calories)}
        </span>
      </div>
    </div>
  );
}
