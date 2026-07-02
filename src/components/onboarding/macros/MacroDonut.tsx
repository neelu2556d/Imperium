"use client";

const PROTEIN_COLOR = "var(--color-mint)";
const CARBS_COLOR = "var(--color-amber)";
const FAT_COLOR = "rgba(255, 255, 255, 0.38)";

interface MacroDonutProps {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Live calorie-split ring. Segments are proportional to each macro's calorie
 * contribution (protein/carbs 4 kcal/g, fat 9 kcal/g); the centre shows the
 * user's total calorie target. Recomputes on every keystroke.
 */
export default function MacroDonut({
  calories,
  proteinG,
  carbsG,
  fatG,
}: MacroDonutProps) {
  const proteinCal = proteinG * 4;
  const carbsCal = carbsG * 4;
  const fatCal = fatG * 9;
  const sum = proteinCal + carbsCal + fatCal;

  const segments = [
    { key: "protein", label: "Protein", grams: proteinG, cal: proteinCal, color: PROTEIN_COLOR },
    { key: "carbs", label: "Carbs", grams: carbsG, cal: carbsCal, color: CARBS_COLOR },
    { key: "fat", label: "Fat", grams: fatG, cal: fatCal, color: FAT_COLOR },
  ];

  const size = 208;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Calorie split by macro">
          {/* track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
          />
          <g transform={`rotate(-90 ${center} ${center})`}>
            {segments.map((seg) => {
              const fraction = sum > 0 ? seg.cal / sum : 0;
              const dash = fraction * circumference;
              const circle = (
                <circle
                  key={seg.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  style={{
                    transition:
                      "stroke-dasharray 300ms var(--ease-DEFAULT), stroke-dashoffset 300ms var(--ease-DEFAULT)",
                  }}
                />
              );
              offset += dash;
              return circle;
            })}
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="mono text-3xl font-semibold leading-none">
            {Math.round(calories)}
          </span>
          <span className="mt-1 text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            kcal / day
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: seg.color }}
              aria-hidden="true"
            />
            <span className="text-muted-strong">{seg.label}</span>
            <span className="text-muted">{Math.round(seg.grams)}g</span>
          </div>
        ))}
      </div>
    </div>
  );
}
