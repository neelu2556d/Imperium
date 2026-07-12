"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchExerciseProgress,
  type ProgressPoint,
} from "@/lib/supabase/session";
import { formatWeight } from "@/lib/train/overload";

/* ------------------------------------------------------------------ *
 * A dual-axis progressive-overload chart, hand-rolled in SVG so it
 * inherits the theme tokens (no default chart colours) and stays a
 * zero-dependency sibling of the Sparkline. It plots two series over
 * a session's logged history:
 *   • top-set weight  — solid mint line + a tappable dot per session
 *                       (left / primary axis)
 *   • total volume    — a lighter ghost-mint dashed line
 *                       (right / secondary axis)
 * A range filter, a stat summary, and an on-tap tooltip sit around it.
 * ------------------------------------------------------------------ */

type Range = "1M" | "3M" | "6M" | "1Y" | "All";
const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "All"];
const RANGE_MONTHS: Record<Range, number | null> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  All: null,
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Jun 8" from a local YYYY-MM-DD (no UTC day shift). */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}`;
}

/** "Jun 8, 2026" for the tooltip header. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}, ${y}`;
}

/** Today as local YYYY-MM-DD, minus `months` — the range-filter cutoff. */
function cutoffISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

interface ProgressGraphProps {
  exerciseId: string;
  /** Plot area height in px (excludes the tabs/stat row). */
  height?: number;
  className?: string;
}

// Plot-area insets: room for weight labels (left), volume labels (right),
// and date labels (bottom).
const PAD_L = 34;
const PAD_R = 42;
const PAD_T = 14;
const PAD_B = 24;

export default function ProgressGraph({
  exerciseId,
  height = 220,
  className,
}: ProgressGraphProps) {
  const [all, setAll] = useState<ProgressPoint[] | null>(null);
  const [range, setRange] = useState<Range>("All");
  const [active, setActive] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchExerciseProgress(exerciseId).then((rows) => {
      if (!cancelled) setAll(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // Measure the container so the SVG renders at true pixel size (crisp text,
  // accurate dot hit-testing) rather than being viewBox-stretched.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    if (!all) return [];
    const months = RANGE_MONTHS[range];
    if (months == null) return all;
    const cut = cutoffISO(months);
    return all.filter((p) => p.date >= cut);
  }, [all, range]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const best = points.reduce((m, p) => Math.max(m, p.weight), 0);
    const last = points[points.length - 1].weight;
    const first = points[0].weight;
    return { best, last, change: last - first };
  }, [points]);

  const totalSessions = all?.length ?? 0;

  return (
    <div className={className}>
      {/* ---------- range tabs ---------- */}
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
                setRange(r);
                setActive(null);
              }}
              data-no-vitality
              className="rounded-full px-2.5 py-1 transition-colors"
              style={{
                border: "1px solid",
                borderColor: on
                  ? "var(--color-mint)"
                  : "var(--color-border)",
                background: on ? "var(--color-mint)" : "transparent",
                color: on ? "var(--color-mint-ink)" : "var(--color-muted)",
              }}
            >
              {r === "All" ? "All" : r}
            </button>
          );
        })}
      </div>

      {/* ---------- stat summary ---------- */}
      {stats && (
        <div className="mono mt-3 flex items-center gap-4 text-[0.72rem] tabular-nums">
          <Stat label="Best" value={`${formatWeight(stats.best)}kg`} accent />
          <span aria-hidden style={{ color: "var(--color-border-strong)" }}>
            |
          </span>
          <Stat label="Last" value={`${formatWeight(stats.last)}kg`} />
          <span aria-hidden style={{ color: "var(--color-border-strong)" }}>
            |
          </span>
          <Stat
            label="Change"
            value={`${stats.change >= 0 ? "+" : ""}${formatWeight(
              stats.change
            )}kg`}
            tone={stats.change > 0 ? "up" : stats.change < 0 ? "down" : "flat"}
          />
        </div>
      )}

      {/* ---------- plot ---------- */}
      <div
        ref={wrapRef}
        className="relative mt-4 w-full"
        style={{ height }}
      >
        {all === null ? (
          <div className="mono absolute inset-0 flex items-center justify-center text-xs text-muted">
            Loading…
          </div>
        ) : totalSessions < 2 ? (
          <Placeholder height={height} />
        ) : width > 0 ? (
          <Chart
            points={points}
            width={width}
            height={height}
            active={active}
            onActivate={setActive}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- stat cell ---------------- */

function Stat({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "up" | "down" | "flat";
}) {
  const valueColor = accent
    ? "var(--color-mint)"
    : tone === "up"
      ? "var(--color-mint)"
      : tone === "down"
        ? "var(--color-amber)"
        : "var(--color-fg)";
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className="text-[0.55rem] uppercase tracking-[0.14em]"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </span>
      <span style={{ color: valueColor }}>{value}</span>
    </span>
  );
}

/* ---------------- empty state ---------------- */

function Placeholder({ height }: { height: number }) {
  return (
    <div className="absolute inset-0">
      {/* ghost chart outline behind the copy */}
      <svg
        width="100%"
        height={height}
        viewBox="0 0 300 200"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 opacity-40"
      >
        <line
          x1="0"
          y1="150"
          x2="300"
          y2="150"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
        <path
          d="M4 150 C 60 150, 90 110, 150 100 S 250 55, 296 40"
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth="1.4"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <p
          className="max-w-[15rem] text-center text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Keep logging — your progress curve appears after your second session.
        </p>
      </div>
    </div>
  );
}

/* ---------------- the chart ---------------- */

interface ChartProps {
  points: ProgressPoint[];
  width: number;
  height: number;
  active: number | null;
  onActivate: (i: number | null) => void;
}

function Chart({ points, width, height, active, onActivate }: ChartProps) {
  const innerW = Math.max(0, width - PAD_L - PAD_R);
  const innerH = Math.max(0, height - PAD_T - PAD_B);

  if (points.length < 2) {
    return (
      <div className="mono flex h-full items-center justify-center text-center text-xs text-muted">
        Not enough sessions in this range yet.
      </div>
    );
  }

  const n = points.length;
  const xAt = (i: number) =>
    PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  // Independent domains for the two axes, each padded ~8% so the lines never
  // graze the frame.
  const domain = (vals: number[]) => {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (hi === lo) return [lo - 1, hi + 1] as const;
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad] as const;
  };
  const [wLo, wHi] = domain(points.map((p) => p.weight));
  const [vLo, vHi] = domain(points.map((p) => p.volume));

  const yW = (v: number) => PAD_T + (1 - (v - wLo) / (wHi - wLo)) * innerH;
  const yV = (v: number) => PAD_T + (1 - (v - vLo) / (vHi - vLo)) * innerH;

  const weightPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yW(p.weight).toFixed(1)}`)
    .join(" ");
  const volumePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yV(p.volume).toFixed(1)}`)
    .join(" ");

  // Thin out x labels so ~5 show at most, always including the last session.
  const maxLabels = Math.max(2, Math.floor(innerW / 56));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const showLabel = (i: number) => i === n - 1 || i % step === 0;

  // 3 horizontal gridlines; each carries a weight tick (left) + volume (right).
  const grid = [0, 0.5, 1];

  const activePoint = active != null ? points[active] : null;

  return (
    <div className="relative h-full w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Progressive overload chart"
        style={{ overflow: "visible", display: "block" }}
      >
        {/* dismiss tooltip when tapping empty space */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={() => onActivate(null)}
        />

        {/* gridlines + dual-axis ticks */}
        {grid.map((f) => {
          const y = PAD_T + f * innerH;
          const wVal = wHi - f * (wHi - wLo);
          const vVal = vHi - f * (vHi - vLo);
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
                fill="var(--color-mint)"
                opacity="0.7"
              >
                {Math.round(wVal)}
              </text>
              <text
                x={PAD_L + innerW + 6}
                y={y + 3}
                textAnchor="start"
                className="mono"
                fontSize="9"
                fill="var(--color-mint-soft)"
                opacity="0.45"
              >
                {formatVolume(vVal)}
              </text>
            </g>
          );
        })}

        {/* Both lines draw left→right on tab entry, simultaneously (800ms
            easeInOut). A left-anchored clip rect wipes across, which reveals the
            solid and dashed lines together without disturbing the volume line's
            dash pattern (stroke-dashoffset can't be borrowed here). */}
        <defs>
          <clipPath id="og-reveal">
            <rect
              className="vt-wipe"
              x={0}
              y={0}
              width={width}
              height={height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#og-reveal)">
          {/* volume — ghost mint dashed (secondary axis) */}
          <path
            d={volumePath}
            fill="none"
            stroke="var(--color-mint-soft)"
            strokeWidth="1.6"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.45"
          />

          {/* weight — solid mint (primary axis) */}
          <path
            d={weightPath}
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* x-axis date labels */}
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

        {/* weight dots + generous tap targets */}
        {points.map((p, i) => {
          const cx = xAt(i);
          const cy = yW(p.weight);
          const on = i === active;
          return (
            <g key={p.date}>
              {on && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={7}
                  fill="var(--color-mint-glow)"
                  opacity={0.9}
                />
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

      {/* tooltip */}
      {activePoint && active != null && (
        <Tooltip
          point={activePoint}
          x={xAt(active)}
          y={yW(activePoint.weight)}
          width={width}
        />
      )}
    </div>
  );
}

/* ---------------- tooltip ---------------- */

const TIP_W = 132;

function Tooltip({
  point,
  x,
  y,
  width,
}: {
  point: ProgressPoint;
  x: number;
  y: number;
  width: number;
}) {
  // Clamp horizontally so it never spills past the plot; flip below the dot if
  // there isn't room above.
  const left = Math.min(Math.max(x - TIP_W / 2, 4), width - TIP_W - 4);
  const below = y < 96;
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
          {longDate(point.date)}
        </p>
        <p
          className="mono mt-1 text-sm tabular-nums"
          style={{ color: "var(--color-mint)" }}
        >
          {formatWeight(point.weight)}kg
        </p>
        <p className="mono mt-0.5 text-[0.62rem] tabular-nums text-muted">
          {point.reps ?? "—"} reps · {point.sets}{" "}
          {point.sets === 1 ? "set" : "sets"}
        </p>
      </div>
    </div>
  );
}

/** Compact volume tick: 1240 → "1.2k", 640 → "640". */
function formatVolume(v: number): string {
  const n = Math.round(v);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
