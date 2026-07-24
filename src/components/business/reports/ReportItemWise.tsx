"use client";

import { useMemo, useState } from "react";
import type { SalesRow } from "@/lib/supabase/orders";
import type { LotStock } from "@/lib/supabase/business";
import { aggregateByItem, rupees, metres } from "./reportUtils";

// ---------------------------------------------------------------------------
// Donut Chart — pure SVG with animated arc sweep
// ---------------------------------------------------------------------------

const DONUT_COLORS = [
  "var(--accent)",
  "rgb(var(--accent-rgb) / 0.65)",
  "rgb(var(--accent-rgb) / 0.40)",
  "rgb(var(--accent-rgb) / 0.25)",
  "rgba(255,255,255,0.15)",
  "rgba(255,255,255,0.08)",
];

function DonutChart({
  items,
}: {
  items: ReturnType<typeof aggregateByItem>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const cx = 120;
  const cy = 120;
  const r = 80;
  const stroke = 28;
  const circumference = 2 * Math.PI * r;

  // Build arcs — each item gets a fraction of the circumference
  const arcs = useMemo(() => {
    let offset = 0;
    return items.map((item, i) => {
      const fraction = item.pctOfTotal / 100;
      const dashLen = fraction * circumference;
      const gap = circumference - dashLen;
      const startOffset = offset;
      offset += dashLen;
      return { ...item, dashLen, gap, startOffset, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    });
  }, [items, circumference]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
      <p className="mono mb-3 text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        Breakdown by Item
      </p>
      <div className="flex items-center gap-6">
        <svg
          viewBox="0 0 240 240"
          className="shrink-0"
          style={{ width: 200, height: 200 }}
          aria-label="Item breakdown donut chart"
          role="img"
        >
          {/* Background circle */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-card)"
            strokeWidth={stroke}
          />
          {/* Arcs */}
          {arcs.map((arc, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={arc.itemName}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={isHovered ? "var(--accent-hover)" : arc.color}
                strokeWidth={isHovered ? stroke + 4 : stroke}
                strokeDasharray={`${arc.dashLen} ${arc.gap}`}
                strokeDashoffset={-arc.startOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  animation: `donutSweep 800ms cubic-bezier(0.16,1,0.3,1) ${i * 120}ms both`,
                  ["--sweep-dash" as string]: `${arc.dashLen} ${arc.gap}`,
                  ["--sweep-offset" as string]: String(-arc.startOffset),
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onTouchStart={() => setHoveredIdx(i)}
              />
            );
          })}
          {/* Center text */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fill="var(--color-fg)"
            fontSize={16}
            fontFamily="var(--font-mono)"
            fontWeight="bold"
          >
            {items.length}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            items
          </text>
        </svg>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {items.map((item, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <div
                key={item.itemName}
                className="flex items-center gap-2"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span
                  className="text-xs"
                  style={{
                    color: isHovered
                      ? "var(--color-fg)"
                      : "var(--color-muted-strong)",
                  }}
                >
                  {item.itemName}
                </span>
                <span className="mono text-[0.64rem] text-muted">
                  {item.pctOfTotal.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes donutSweep {
          from {
            stroke-dasharray: 0 ${2 * Math.PI * r};
            stroke-dashoffset: 0;
          }
          to {
            stroke-dasharray: var(--sweep-dash);
            stroke-dashoffset: var(--sweep-offset);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes donutSweep {
            from {
              stroke-dasharray: var(--sweep-dash);
              stroke-dashoffset: var(--sweep-offset);
            }
            to {
              stroke-dasharray: var(--sweep-dash);
              stroke-dashoffset: var(--sweep-offset);
            }
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fill Bar — thin horizontal progress inside a cell
// ---------------------------------------------------------------------------

function FillBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--color-card)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: "var(--accent)",
          }}
        />
      </div>
      <span className="mono w-10 text-right text-[0.64rem] tabular-nums text-muted">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportItemWise({
  rows,
  lots,
}: {
  rows: SalesRow[];
  lots: LotStock[];
}) {
  const items = useMemo(() => aggregateByItem(rows, lots), [rows, lots]);
  const totalAmount = useMemo(
    () => items.reduce((s, i) => s + i.amount, 0),
    [items]
  );
  const totalMetres = useMemo(
    () => items.reduce((s, i) => s + i.metresSold, 0),
    [items]
  );

  return (
    <div>
      {/* Table */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-bg-elevated">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr
              className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              {["Item Name", "Active Lots", "Metres Sold", "Amount", "Avg Rate/m", "%"].map(
                (label) => (
                  <th
                    key={label}
                    className={`whitespace-nowrap border-b border-border px-3 py-3 font-normal ${
                      label === "Active Lots" ||
                      label === "Metres Sold" ||
                      label === "Amount" ||
                      label === "Avg Rate/m" ||
                      label === "%"
                        ? "text-right"
                        : "text-left"
                    }`}
                    style={{ background: "var(--color-bg-elevated)" }}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const bg =
                i % 2 === 0
                  ? "var(--color-card)"
                  : "var(--color-card-elevated)";
              return (
                <tr
                  key={item.itemName}
                  style={{ background: bg }}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className="max-w-[12rem] truncate px-3 py-3 text-left font-medium text-fg">
                    {item.itemName}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {item.activeLots}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {metres(item.metresSold)}
                  </td>
                  <td className="mono px-3 py-3 text-right font-semibold tabular-nums text-fg">
                    {rupees(item.amount)}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {rupees(item.avgRate)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <FillBar pct={item.pctOfTotal} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr
              className="mono text-[0.78rem] tabular-nums"
              style={{
                background: "var(--color-bg-elevated)",
                color: "var(--accent)",
              }}
            >
              <td
                className="whitespace-nowrap border-t border-border-strong px-3 py-3 text-left text-[0.6rem] uppercase tracking-[0.12em]"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                TOTAL
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {items.reduce((s, i) => s + i.activeLots, 0)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {metres(totalMetres)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {rupees(totalAmount)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {totalMetres > 0 ? rupees(totalAmount / totalMetres) : "—"}
              </td>
              <td style={{ background: "var(--color-bg-elevated)" }} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Note */}
      <p className="mt-3 text-xs text-muted">
        Dupatta metres are included in total metres. Item name shown is the
        Top/Bottom set name.
      </p>

      {/* Donut chart */}
      {items.length > 0 && <DonutChart items={items} />}
    </div>
  );
}
