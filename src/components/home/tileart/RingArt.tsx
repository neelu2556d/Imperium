"use client";

import { useId } from "react";

interface RingArtProps {
  /** 0–1 progress of last night's sleep vs goal. */
  progress: number;
  /** When true (sleep below goal) the arc + accents shift to amber. */
  warn: boolean;
}

const W = 300;
const H = 220;
const CX = W / 2;
const CY = H / 2;
const R = 62; // progress-arc radius

/**
 * Vitals tile art — concentric rings that ease in and breathe, plus a sleep
 * progress arc that draws itself around the outer ring. White by default,
 * amber when the latest night is below goal.
 */
export default function RingArt({ progress, warn }: RingArtProps) {
  const id = useId().replace(/:/g, "");
  const accent = warn ? "var(--color-amber)" : "rgba(255,255,255,0.92)";
  const glow = warn ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.4)";

  const circ = 2 * Math.PI * R;
  const clamped = Math.max(0.04, Math.min(1, progress || 0));
  const dash = circ * clamped;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`rg-${id}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(110,231,183,0.10)" />
          <stop offset="100%" stopColor="rgba(110,231,183,0)" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r={90} fill={`url(#rg-${id})`} />

      {/* breathing concentric rings */}
      {[38, 62, 86].map((r, i) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
          className="vee-ring"
          style={{ "--d": `${0.15 * i}s` } as React.CSSProperties}
        />
      ))}

      {/* track under the progress arc */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={4}
      />

      {/* the drawing progress arc (starts at 12 o'clock) */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke={accent}
        strokeWidth={4}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CY})`}
        className="vee-draw"
        style={
          {
            "--len": circ,
            strokeDasharray: `${dash} ${circ}`,
            filter: `drop-shadow(0 0 4px ${glow})`,
          } as React.CSSProperties
        }
      />

      {/* endpoint node at the arc tip */}
      <circle
        cx={CX + R * Math.cos(2 * Math.PI * clamped - Math.PI / 2)}
        cy={CY + R * Math.sin(2 * Math.PI * clamped - Math.PI / 2)}
        r={4}
        fill={warn ? "#ffe9c8" : "#ffffff"}
        className="vee-node"
        style={
          { "--d": "1.4s", filter: `drop-shadow(0 0 6px ${glow})` } as React.CSSProperties
        }
      />
    </svg>
  );
}
