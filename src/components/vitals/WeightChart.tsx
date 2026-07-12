"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WeightPoint } from "@/lib/supabase/vitals";

/* A single-axis line chart for body weight, sharing the overload graph's visual
 * language: theme-token mint line, a dot per log, thinned date labels, three
 * faint gridlines, and an on-tap tooltip. Rendered at measured pixel size so
 * text stays crisp and dot hit-testing is accurate. */

export type WeightRange = "1M" | "3M" | "6M" | "All";
const RANGES: WeightRange[] = ["1M", "3M", "6M", "All"];
const RANGE_MONTHS: Record<WeightRange, number | null> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  All: null,
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}`;
}
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}, ${y}`;
}
function cutoffISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
function fmt(w: number): string {
  return Number(w.toFixed(1)).toString();
}

const PAD_L = 34;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 24;
const TIP_W = 116;

export default function WeightChart({
  points,
  range,
  onRangeChange,
  unit,
  height = 200,
}: {
  points: WeightPoint[];
  range: WeightRange;
  onRangeChange: (r: WeightRange) => void;
  /** Display unit; values are stored in kg and converted here. */
  unit: "kg" | "lb";
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toDisplay = (kg: number) => (unit === "lb" ? kg * 2.20462 : kg);

  const filtered = useMemo(() => {
    const months = RANGE_MONTHS[range];
    if (months == null) return points;
    const cut = cutoffISO(months);
    return points.filter((p) => p.date >= cut);
  }, [points, range]);

  return (
    <div>
      <div
        className="mono flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.12em]"
        role="tablist"
        aria-label="Time range"
      >
        {RANGES.map((r) => {
          const on = r === range;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                onRangeChange(r);
                setActive(null);
              }}
              data-no-vitality
              className="rounded-full px-2.5 py-1 transition-colors"
              style={{
                border: "1px solid",
                borderColor: on ? "var(--color-mint)" : "var(--color-border)",
                background: on ? "var(--color-mint)" : "transparent",
                color: on ? "var(--color-mint-ink)" : "var(--color-muted)",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div ref={wrapRef} className="relative mt-3 w-full" style={{ height }}>
        {width > 0 && filtered.length >= 2 ? (
          <Plot
            points={filtered}
            width={width}
            height={height}
            active={active}
            onActivate={setActive}
            toDisplay={toDisplay}
            unit={unit}
          />
        ) : (
          <div className="mono flex h-full items-center justify-center text-center text-xs text-muted">
            {points.length === 0
              ? "Log your weight to start the trend."
              : "Not enough logs in this range yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function Plot({
  points,
  width,
  height,
  active,
  onActivate,
  toDisplay,
  unit,
}: {
  points: WeightPoint[];
  width: number;
  height: number;
  active: number | null;
  onActivate: (i: number | null) => void;
  toDisplay: (kg: number) => number;
  unit: "kg" | "lb";
}) {
  const innerW = Math.max(0, width - PAD_L - PAD_R);
  const innerH = Math.max(0, height - PAD_T - PAD_B);
  const n = points.length;

  const vals = points.map((p) => toDisplay(p.weight));
  const lo0 = Math.min(...vals);
  const hi0 = Math.max(...vals);
  const [lo, hi] =
    hi0 === lo0 ? [lo0 - 1, hi0 + 1] : [lo0 - (hi0 - lo0) * 0.12, hi0 + (hi0 - lo0) * 0.12];

  const xAt = (i: number) =>
    PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(vals[i]).toFixed(1)}`)
    .join(" ");

  const maxLabels = Math.max(2, Math.floor(innerW / 56));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const showLabel = (i: number) => i === n - 1 || i % step === 0;
  const grid = [0, 0.5, 1];

  const activePoint = active != null ? points[active] : null;

  return (
    <div className="relative h-full w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Body weight trend"
        style={{ overflow: "visible", display: "block" }}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={() => onActivate(null)}
        />
        {grid.map((f) => {
          const y = PAD_T + f * innerH;
          const v = hi - f * (hi - lo);
          return (
            <g key={f}>
              <line
                x1={PAD_L}
                y1={y}
                x2={PAD_L + innerW}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                className="mono"
                fontSize="9"
                fill="var(--color-muted)"
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* draws left→right on mount (800ms easeInOut) via pathLength
            normalisation — no JS measurement needed */}
        <path
          d={path}
          fill="none"
          stroke="var(--color-mint)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="vt-draw"
          style={{ ["--vt-len" as string]: "1" }}
        />

        {points.map((p, i) =>
          showLabel(i) ? (
            <text
              key={p.date}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="mono"
              fontSize="9"
              fill="var(--color-muted)"
            >
              {shortDate(p.date)}
            </text>
          ) : null
        )}

        {points.map((p, i) => {
          const cx = xAt(i);
          const cy = yAt(vals[i]);
          const on = i === active;
          return (
            <g key={p.date}>
              {on && (
                <circle cx={cx} cy={cy} r={7} fill="var(--color-mint-glow)" opacity={0.9} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={on ? 4 : 3}
                fill="var(--color-mint)"
                stroke="var(--color-bg)"
                strokeWidth="1.5"
              />
              <circle
                cx={cx}
                cy={cy}
                r={16}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(on ? null : i);
                }}
              />
            </g>
          );
        })}
      </svg>

      {activePoint && active != null && (
        <Tip
          date={activePoint.date}
          value={`${fmt(toDisplay(activePoint.weight))}${unit}`}
          x={xAt(active)}
          y={yAt(vals[active])}
          width={width}
        />
      )}
    </div>
  );
}

function Tip({
  date,
  value,
  x,
  y,
  width,
}: {
  date: string;
  value: string;
  x: number;
  y: number;
  width: number;
}) {
  const left = Math.min(Math.max(x - TIP_W / 2, 4), width - TIP_W - 4);
  const below = y < 80;
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left,
        top: below ? y + 14 : undefined,
        bottom: below ? undefined : `calc(100% - ${y - 12}px)`,
        width: TIP_W,
      }}
    >
      <div
        className="rounded-lg border p-2.5"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          boxShadow: "var(--shadow-glass)",
        }}
      >
        <p className="mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
          {longDate(date)}
        </p>
        <p className="mono mt-1 text-sm tabular-nums" style={{ color: "var(--color-mint)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
