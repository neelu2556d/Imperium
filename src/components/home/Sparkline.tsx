interface SparklineProps {
  /** Data points, oldest → newest. Empty renders a flat dashed placeholder. */
  values: number[];
  /** Line + end-dot color. Defaults to mint. */
  color?: string;
  /** Glow color for the end dot. Defaults to the mint glow token. */
  glowColor?: string;
  /** SVG width — a number (px) or a CSS length like "100%" to fill its cell. */
  width?: number | string;
  height?: number;
}

const VB_W = 100;
const VB_H = 32;
const PAD_Y = 5;

/**
 * Axis-less mini line chart for the bento cards: a thin curve with a single
 * glowing dot on the most recent point. With no data it draws a flat dashed
 * line so the card still reads as "a chart, waiting for data".
 */
export default function Sparkline({
  values,
  color = "var(--color-mint)",
  glowColor = "var(--color-mint-glow)",
  width = 120,
  height = 40,
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="2"
          y1={VB_H / 2}
          x2={VB_W - 2}
          y2={VB_H / 2}
          stroke="var(--color-border-strong)"
          strokeWidth="1.4"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (VB_W - 4) + 2;
    const y = PAD_Y + (1 - (v - min) / span) * (VB_H - PAD_Y * 2);
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* soft glow halo */}
      <circle cx={lastX} cy={lastY} r="4.5" fill={glowColor} opacity="0.9" />
      {/* solid dot */}
      <circle cx={lastX} cy={lastY} r="2.2" fill={color} />
    </svg>
  );
}
