"use client";

import { useMemo } from "react";
import type { SalesRow } from "@/lib/supabase/orders";
import { aggregateByParty, rupees, metres } from "./reportUtils";

// ---------------------------------------------------------------------------
// Horizontal Bar Chart — top 10 parties
// ---------------------------------------------------------------------------

function HorizontalBarChart({
  parties,
}: {
  parties: ReturnType<typeof aggregateByParty>;
}) {
  const top10 = useMemo(() => parties.slice(0, 10), [parties]);
  const maxAmount = useMemo(
    () => Math.max(...top10.map((p) => p.totalAmount), 1),
    [top10]
  );
  const barH = 26;
  const gap = 6;
  const chartH = top10.length * (barH + gap);

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
      <p className="mono mb-3 text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        Top 10 Parties by Sale Amount
      </p>
      <svg
        viewBox={`0 0 500 ${chartH + 10}`}
        className="w-full"
        style={{ height: chartH + 10 }}
        aria-label="Top 10 parties bar chart"
        role="img"
      >
        {top10.map((p, i) => {
          const w = (p.totalAmount / maxAmount) * 350;
          const y = i * (barH + gap);
          return (
            <g key={p.partyName}>
              {/* Label */}
              <text
                x={0}
                y={y + barH / 2 + 4}
                fill="var(--color-muted-strong)"
                fontSize={10}
                fontFamily="var(--font-mono)"
              >
                {p.partyName.length > 14
                  ? p.partyName.slice(0, 13) + "…"
                  : p.partyName}
              </text>
              {/* Bar */}
              <rect
                x={120}
                y={y}
                width={0}
                height={barH}
                rx={4}
                fill="var(--accent)"
                opacity={0.7}
                style={{
                  animation: `hBarGrow 500ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                  // CSS custom property for target width
                  ["--bar-w" as string]: `${w}px`,
                }}
              />
              {/* Amount label */}
              <text
                x={128 + w}
                y={y + barH / 2 + 4}
                fill="var(--color-muted)"
                fontSize={9}
                fontFamily="var(--font-mono)"
                className="hbar-label"
                style={{
                  animation: `hBarGrow 500ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                  ["--bar-w" as string]: `${w}px`,
                }}
              >
                {rupees(p.totalAmount)}
              </text>
            </g>
          );
        })}
      </svg>

      <style>{`
        @keyframes hBarGrow {
          from {
            width: 0;
          }
          to {
            width: var(--bar-w, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes hBarGrow {
            from { width: var(--bar-w, 0); }
            to { width: var(--bar-w, 0); }
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

export default function ReportPartyWise({ rows }: { rows: SalesRow[] }) {
  const parties = useMemo(() => aggregateByParty(rows), [rows]);
  const totalOrders = useMemo(
    () => parties.reduce((s, p) => s + p.orders, 0),
    [parties]
  );
  const totalAmount = useMemo(
    () => parties.reduce((s, p) => s + p.totalAmount, 0),
    [parties]
  );

  return (
    <div>
      {/* Summary */}
      <p className="mono text-[0.72rem] text-muted-strong">
        {parties.length} part{parties.length !== 1 ? "ies" : "y"} ·{" "}
        {totalOrders} total order{totalOrders !== 1 ? "s" : ""} ·{" "}
        <span style={{ color: "var(--accent)" }}>{rupees(totalAmount)} total</span>
      </p>

      {/* Table */}
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-border bg-bg-elevated">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr
              className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              {["Rank", "Party", "Orders", "Total Metres", "Amount", "% of Period"].map(
                (label) => (
                  <th
                    key={label}
                    className={`whitespace-nowrap border-b border-border px-3 py-3 font-normal ${
                      label === "Rank" ||
                      label === "Orders" ||
                      label === "Total Metres" ||
                      label === "Amount" ||
                      label === "% of Period"
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
            {parties.map((p, i) => {
              const rank = i + 1;
              const isTop3 = rank <= 3;
              const bg = isTop3
                ? "rgb(var(--accent-rgb) / 0.04)"
                : i % 2 === 0
                  ? "var(--color-card)"
                  : "var(--color-card-elevated)";
              return (
                <tr
                  key={p.partyName}
                  style={{ background: bg }}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {rank}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-3 text-left font-medium text-fg">
                    {p.partyName}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {p.orders}
                  </td>
                  <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                    {metres(p.totalMetres)}
                  </td>
                  <td className="mono px-3 py-3 text-right font-semibold tabular-nums text-fg">
                    {rupees(p.totalAmount)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <FillBar pct={p.pctOfPeriod} />
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
              <td style={{ background: "var(--color-bg-elevated)" }} />
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
                {metres(rows.reduce((s, r) => s + r.totalMetres, 0))}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {rupees(totalAmount)}
              </td>
              <td style={{ background: "var(--color-bg-elevated)" }} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Horizontal bar chart */}
      {parties.length > 0 && <HorizontalBarChart parties={parties} />}
    </div>
  );
}
