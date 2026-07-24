"use client";

import { useMemo, useState } from "react";
import type { SalesRow } from "@/lib/supabase/orders";
import type { Period } from "./reportUtils";
import {
  aggregateByDay,
  rupees,
  metres,
  longDate,
  chartDate,
  periodBounds,
} from "./reportUtils";

// ---------------------------------------------------------------------------
// Bar Chart — pure SVG with animated rise
// ---------------------------------------------------------------------------

function BarChart({ days }: { days: ReturnType<typeof aggregateByDay> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxAmount = useMemo(
    () => Math.max(...days.map((d) => d.totalAmount), 1),
    [days]
  );

  const chartH = 220;
  const barGap = days.length > 20 ? 2 : 4;
  const barW = Math.max(
    2,
    Math.min(20, (600 - days.length * barGap) / days.length)
  );
  const totalW = days.length * (barW + barGap);
  const labelEvery = days.length > 30 ? 7 : days.length > 15 ? 3 : 1;

  const hovered = hoveredIdx !== null ? days[hoveredIdx] : null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <svg
          viewBox={`0 0 ${Math.max(totalW + 40, 300)} ${chartH + 40}`}
          className="w-full"
          style={{ minWidth: Math.min(totalW + 40, 600), height: chartH + 40 }}
          aria-label="Daily sale bar chart"
          role="img"
        >
          {/* Y-axis line */}
          <line
            x1={30}
            y1={0}
            x2={30}
            y2={chartH}
            stroke="var(--color-border)"
            strokeWidth={1}
          />

          {/* Bars */}
          {days.map((d, i) => {
            const barH =
              d.totalAmount > 0
                ? Math.max(2, (d.totalAmount / maxAmount) * (chartH - 10))
                : 0;
            const x = 35 + i * (barW + barGap);
            const y = chartH - barH;
            const isHovered = hoveredIdx === i;
            return (
              <g key={d.date}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={
                    d.totalAmount === 0
                      ? "transparent"
                      : isHovered
                        ? "var(--accent-hover)"
                        : "var(--accent)"
                  }
                  opacity={d.totalAmount === 0 ? 0 : isHovered ? 1 : 0.75}
                  style={{
                    animation: `barRise 500ms cubic-bezier(0.16,1,0.3,1) ${i * 15}ms both`,
                    transformOrigin: `${x + barW / 2}px ${chartH}px`,
                  }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onTouchStart={() => setHoveredIdx(i)}
                />
                {/* Date labels */}
                {i % labelEvery === 0 && barW >= 3 && (
                  <text
                    x={x + barW / 2}
                    y={chartH + 14}
                    textAnchor="middle"
                    fill="var(--color-muted)"
                    fontSize={7}
                    fontFamily="var(--font-mono)"
                  >
                    {chartDate(d.date)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {hovered && hoveredIdx !== null && (
            <foreignObject
              x={Math.min(
                35 + hoveredIdx * (barW + barGap) - 50,
                totalW - 100
              )}
              y={Math.max(0, chartH - (hovered.totalAmount / maxAmount) * (chartH - 10) - 55)}
              width={120}
              height={50}
            >
              <div
                style={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-fg)",
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ color: "var(--color-muted)" }}>
                  {longDate(hovered.date)}
                </div>
                <div>
                  {hovered.orders} order{hovered.orders !== 1 ? "s" : ""} ·{" "}
                  {metres(hovered.totalMetres)}
                </div>
                <div style={{ color: "var(--accent)" }}>
                  {rupees(hovered.totalAmount)}
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      <style>{`
        @keyframes barRise {
          from {
            transform: scaleY(0);
          }
          to {
            transform: scaleY(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes barRise {
            from { transform: scaleY(1); }
            to { transform: scaleY(1); }
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportPerDay({
  rows,
  cursor,
  period,
}: {
  rows: SalesRow[];
  cursor: Date;
  period: Period;
}) {
  const days = useMemo(
    () => aggregateByDay(rows, cursor, period),
    [rows, cursor, period]
  );

  const totalOrders = useMemo(
    () => days.reduce((s, d) => s + d.orders, 0),
    [days]
  );
  const totalMetres = useMemo(
    () => days.reduce((s, d) => s + d.totalMetres, 0),
    [days]
  );
  const totalAmount = useMemo(
    () => days.reduce((s, d) => s + d.totalAmount, 0),
    [days]
  );

  return (
    <div>
      {/* Summary stats */}
      <div
        className="grid grid-cols-3 gap-3 rounded-xl border border-border p-4"
        style={{ background: "var(--color-card-elevated)" }}
      >
        <StatBlock label="Total Orders" value={String(totalOrders)} />
        <StatBlock label="Total Metres" value={metres(totalMetres)} />
        <StatBlock label="Total Amount" value={rupees(totalAmount)} />
      </div>

      {/* Bar chart */}
      <BarChart days={days} />

      {/* Table */}
      <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-border bg-bg-elevated">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr
              className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <th
                className="whitespace-nowrap border-b border-border px-3 py-3 text-left font-normal"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                Date
              </th>
              <th
                className="whitespace-nowrap border-b border-border px-3 py-3 text-right font-normal"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                Orders
              </th>
              <th
                className="whitespace-nowrap border-b border-border px-3 py-3 text-right font-normal"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                Total Metres
              </th>
              <th
                className="whitespace-nowrap border-b border-border px-3 py-3 text-right font-normal"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const bg =
                i % 2 === 0
                  ? "var(--color-card)"
                  : "var(--color-card-elevated)";
              const hasOrders = d.orders > 0;
              return (
                <tr
                  key={d.date}
                  style={{ background: bg }}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className="mono whitespace-nowrap px-3 py-3 text-left text-muted-strong">
                    {longDate(d.date)}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {hasOrders ? d.orders : "—"}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {hasOrders ? metres(d.totalMetres) : "—"}
                  </td>
                  <td className="mono px-3 py-3 text-right font-semibold tabular-nums text-fg">
                    {hasOrders ? rupees(d.totalAmount) : "—"}
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
                {totalOrders}
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
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p
        className="mono mt-1 text-lg font-bold tabular-nums"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </p>
    </div>
  );
}
