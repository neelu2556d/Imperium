"use client";

/**
 * Two simple body silhouettes (front + back) with tappable muscle regions.
 * Region values match the step-5 chip labels exactly, so tapping the body and
 * tapping a chip drive the same selection. `disabledRegions` are dimmed and
 * inert (used when the 2-pick cap is reached).
 */

export type BodyRegion =
  | "Chest"
  | "Back / lats"
  | "Shoulders / delts"
  | "Arms (bi/tri)"
  | "Legs / glutes";

interface RegionRect {
  region: BodyRegion;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Overlay rectangles per view. Regions that exist on both views (arms, legs,
// shoulders) appear in each list and highlight together.
const FRONT: RegionRect[] = [
  { region: "Shoulders / delts", x: 26, y: 30, w: 48, h: 9 },
  { region: "Chest", x: 35, y: 41, w: 30, h: 20 },
  { region: "Arms (bi/tri)", x: 20, y: 41, w: 10, h: 44 },
  { region: "Arms (bi/tri)", x: 70, y: 41, w: 10, h: 44 },
  { region: "Legs / glutes", x: 37, y: 92, w: 12, h: 66 },
  { region: "Legs / glutes", x: 51, y: 92, w: 12, h: 66 },
];

const BACK: RegionRect[] = [
  { region: "Shoulders / delts", x: 26, y: 30, w: 48, h: 9 },
  { region: "Back / lats", x: 35, y: 41, w: 30, h: 30 },
  { region: "Arms (bi/tri)", x: 20, y: 41, w: 10, h: 44 },
  { region: "Arms (bi/tri)", x: 70, y: 41, w: 10, h: 44 },
  { region: "Legs / glutes", x: 37, y: 92, w: 12, h: 66 },
  { region: "Legs / glutes", x: 51, y: 92, w: 12, h: 66 },
];

function Silhouette({
  rects,
  label,
  selected,
  onToggle,
  disabledRegions,
}: {
  rects: RegionRect[];
  label: string;
  selected: string[];
  onToggle: (region: BodyRegion) => void;
  disabledRegions: Set<string>;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 100 175"
        width={96}
        height={168}
        role="group"
        aria-label={`${label} body`}
      >
        {/* silhouette base */}
        <g fill="var(--color-card-elevated)" stroke="var(--color-border-strong)" strokeWidth={1}>
          <circle cx={50} cy={16} r={10} />
          <rect x={33} y={28} width={34} height={60} rx={8} />
          <rect x={20} y={30} width={11} height={58} rx={5} />
          <rect x={69} y={30} width={11} height={58} rx={5} />
          <rect x={36} y={88} width={13} height={72} rx={5} />
          <rect x={51} y={88} width={13} height={72} rx={5} />
        </g>

        {/* interactive regions */}
        {rects.map((r, i) => {
          const isSelected = selected.includes(r.region);
          const isDisabled = disabledRegions.has(r.region);
          return (
            <rect
              key={`${r.region}-${i}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={4}
              onClick={() => !isDisabled && onToggle(r.region)}
              style={{
                cursor: isDisabled ? "default" : "pointer",
                fill: isSelected ? "var(--color-mint)" : "rgba(255,255,255,0.05)",
                fillOpacity: isSelected ? 0.75 : isDisabled ? 0.15 : 0.4,
                stroke: isSelected ? "var(--color-mint)" : "transparent",
                strokeWidth: 1,
                transition: "fill 160ms, fill-opacity 160ms",
              }}
            />
          );
        })}
      </svg>
      <span className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

export default function BodyMap({
  selected,
  onToggle,
  disabledRegions = new Set(),
}: {
  selected: string[];
  onToggle: (region: BodyRegion) => void;
  disabledRegions?: Set<string>;
}) {
  return (
    <div className="flex items-start justify-center gap-3">
      <Silhouette
        rects={FRONT}
        label="Front"
        selected={selected}
        onToggle={onToggle}
        disabledRegions={disabledRegions}
      />
      <Silhouette
        rects={BACK}
        label="Back"
        selected={selected}
        onToggle={onToggle}
        disabledRegions={disabledRegions}
      />
    </div>
  );
}
