"use client";

import { useId } from "react";

interface BarsArtProps {
  /** Daily calorie series (oldest → newest). */
  values: number[];
}

const W = 400;
const H = 220;
const PAD_X = 26;
const PAD_TOP = 44;
const BASE = H - 30;

/**
 * Fuel tile art — a row of bars that grow up from the baseline (one per recent
 * day), mint with a brighter, taller "today" bar on the right. Bars animate in
 * staggered via scaleY.
 */
export default function BarsArt({ values }: BarsArtProps) {
  const id = useId().replace(/:/g, "");
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0);
  const data = clean.length >= 3 ? clean.slice(-7) : [0.5, 0.7, 0.4, 0.85, 0.6, 0.75, 0.9];
  const max = Math.max(...data, 1);

  const n = data.length;
  const innerW = W - PAD_X * 2;
  const slot = innerW / n;
  const barW = Math.min(26, slot * 0.52);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" />
          <stop offset="100%" stopColor="rgba(110,231,183,0.35)" />
        </linearGradient>
      </defs>

      {/* baseline */}
      <line
        x1={PAD_X}
        y1={BASE}
        x2={W - PAD_X}
        y2={BASE}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />

      {data.map((v, i) => {
        const h = Math.max(6, ((BASE - PAD_TOP) * v) / max);
        const x = PAD_X + slot * i + (slot - barW) / 2;
        const y = BASE - h;
        const isLast = i === n - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={barW / 2.4}
            fill={isLast ? "#eafff4" : `url(#bg-${id})`}
            className="vee-bar"
            style={
              {
                "--d": `${0.06 * i}s`,
                opacity: isLast ? 1 : 0.9,
                filter: isLast
                  ? "drop-shadow(0 0 5px rgba(110,231,183,0.85)) drop-shadow(0 0 12px rgba(110,231,183,0.4))"
                  : "none",
              } as React.CSSProperties
            }
          />
        );
      })}
    </svg>
  );
}
