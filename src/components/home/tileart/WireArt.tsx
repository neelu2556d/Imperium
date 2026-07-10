"use client";

import { useId } from "react";
import { seriesPoints, smoothPath, pathLength } from "./geometry";

interface WireArtProps {
  /** Training volume series (oldest → newest). */
  values: number[];
}

const W = 400;
const H = 220;

/**
 * Train tile art — a self-drawing volume line with an under-fill wash and a
 * pulsing node at the latest point. Mint accent. The line "draws" once on
 * mount via stroke-dasharray, then holds.
 */
export default function WireArt({ values }: WireArtProps) {
  const id = useId().replace(/:/g, "");
  const pts = seriesPoints(values, W, H, 26, 40);
  const d = smoothPath(pts);
  const len = pathLength(pts);
  const last = pts[pts.length - 1];
  const fill = `${d} L${last.x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`wf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(110,231,183,0.28)" />
          <stop offset="100%" stopColor="rgba(110,231,183,0)" />
        </linearGradient>
      </defs>

      {/* faint under-fill */}
      <path d={fill} fill={`url(#wf-${id})`} opacity={0.9} />

      {/* the drawing line */}
      <path
        d={d}
        fill="none"
        stroke="var(--color-mint)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="vee-draw"
        style={
          {
            "--len": len,
            filter:
              "drop-shadow(0 0 4px rgba(110,231,183,0.5)) drop-shadow(0 0 10px rgba(110,231,183,0.25))",
          } as React.CSSProperties
        }
      />

      {/* pulsing endpoint node */}
      <circle
        cx={last.x}
        cy={last.y}
        r={5}
        fill="#eafff4"
        className="vee-node"
        style={
          {
            "--d": "1.3s",
            filter:
              "drop-shadow(0 0 4px rgba(110,231,183,0.95)) drop-shadow(0 0 9px rgba(110,231,183,0.5))",
          } as React.CSSProperties
        }
      />
    </svg>
  );
}
