"use client";

import { useMemo } from "react";
import type { SalesRow } from "@/lib/supabase/orders";
import type { LotStock } from "@/lib/supabase/business";
import type { Period } from "./reportUtils";
import {
  computeDeepAnalysis,
  rupees,
  metres,
  aggregateByDay,
  filterByPeriod,
  periodBounds,
} from "./reportUtils";

interface Props {
  rows: SalesRow[];
  lots: LotStock[];
  cursor: Date;
  period: Period;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: accent ? "var(--accent)" : "var(--color-border)",
        background: accent ? "var(--accent-muted)" : "var(--bg-elevated)",
      }}
    >
      <p className="text-[0.72rem] uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--fg)" }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[0.72rem] text-muted">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar (for top parties / items)
// ---------------------------------------------------------------------------

function HBar({
  items,
  maxVal,
  color,
}: {
  items: { name: string; value: number; pct: number }[];
  maxVal: number;
  color: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const w = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        return (
          <div key={item.name}>
            <div className="mb-1 flex items-baseline justify-between text-[0.78rem]">
              <span className="truncate text-fg">{item.name}</span>
              <span className="ml-2 shrink-0 tabular-nums text-muted">
                {rupees(item.value)}
                <span className="ml-1 text-[0.68rem]">
                  {item.pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "var(--color-border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${w}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini bar chart for daily trend
// ---------------------------------------------------------------------------

function MiniBarChart({ days }: { days: { date: string; amount: number }[] }) {
  const maxAmount = useMemo(
    () => Math.max(...days.map((d) => d.amount), 1),
    [days]
  );
  const chartH = 80;
  const barGap = days.length > 20 ? 1 : 2;
  const barW = Math.max(
    1,
    Math.min(12, (500 - days.length * barGap) / days.length)
  );
  const totalW = days.length * (barW + barGap);

  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <svg
        viewBox={`0 0 ${Math.max(totalW + 10, 200)} ${chartH}`}
        className="w-full"
        style={{ minWidth: Math.min(totalW + 10, 500), height: chartH }}
        aria-label="Daily sale trend"
        role="img"
      >
        {days.map((d, i) => {
          const barH =
            d.amount > 0
              ? Math.max(1, (d.amount / maxAmount) * (chartH - 4))
              : 0;
          const x = 5 + i * (barW + barGap);
          const y = chartH - barH;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={1}
              fill="var(--accent)"
              opacity={0.6}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportDeepAnalysis({
  rows,
  lots,
  cursor,
  period,
}: Props) {
  const data = useMemo(
    () => computeDeepAnalysis(rows, lots, cursor, period),
    [rows, lots, cursor, period]
  );

  const { start, end } = periodBounds(cursor, period);
  const dailyData = useMemo(() => {
    const filtered = filterByPeriod(rows, cursor, period);
    const aggregated = aggregateByDay(filtered, cursor, period);
    return aggregated.map((d) => ({ date: d.date, amount: d.totalAmount }));
  }, [rows, cursor, period]);

  const maxPartyAmount = useMemo(
    () => Math.max(...data.top3Parties.map((p) => p.amount), 1),
    [data.top3Parties]
  );

  return (
    <div className="space-y-6">
      {/* Section A: What produced this period's revenue */}
      <div>
        <h3 className="serif-italic text-lg text-fg">What Produced This</h3>
        <p className="mt-1 text-[0.78rem] text-muted">
          Understanding the mechanics behind your {rupees(data.targetAmount)}{" "}
          this period.
        </p>

        {/* Key Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total Lots"
            value={String(data.totalLots)}
            sub={`${data.lotsContributed} contributed · ${data.deadStockLots} dead`}
          />
          <StatCard
            label="Avg Sale / Lot"
            value={rupees(data.avgSalePerLot)}
          />
          <StatCard
            label="Metres Sold"
            value={metres(data.totalMetresSold)}
            sub={`${rupees(data.avgRevenuePerMetre)}/m avg`}
          />
          <StatCard
            label="Active Parties"
            value={String(data.activePartiesThisPeriod)}
          />
        </div>

        {/* Lot Performance */}
        {(data.fastestClearingLot || data.slowestClearingLot) && (
          <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
            <h4 className="text-[0.78rem] font-medium uppercase tracking-wide text-muted">
              Lot Performance
            </h4>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.fastestClearingLot && (
                <div className="rounded-lg border border-accent/20 bg-accent-muted p-3">
                  <p className="text-[0.68rem] uppercase text-accent">
                    Fastest Clearing
                  </p>
                  <p className="mt-1 text-sm font-medium text-fg">
                    {data.fastestClearingLot.name}
                  </p>
                  <p className="text-[0.72rem] text-muted">
                    {data.fastestClearingLot.days} days
                  </p>
                </div>
              )}
              {data.slowestClearingLot && (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                  <p className="text-[0.68rem] uppercase text-orange-500">
                    Slowest Clearing
                  </p>
                  <p className="mt-1 text-sm font-medium text-fg">
                    {data.slowestClearingLot.name}
                  </p>
                  <p className="text-[0.72rem] text-muted">
                    {data.slowestClearingLot.days} days ·{" "}
                    {data.slowestClearingLot.unsoldPct}% unsold
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Parties */}
        {data.top3Parties.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
            <h4 className="text-[0.78rem] font-medium uppercase tracking-wide text-muted">
              Top Parties
            </h4>
            <div className="mt-3">
              <HBar
                items={data.top3Parties.map((p) => ({
                  name: p.name,
                  value: p.amount,
                  pct: p.pct,
                }))}
                maxVal={maxPartyAmount}
                color="var(--accent)"
              />
            </div>
          </div>
        )}

        {/* Daily Trend */}
        {dailyData.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-bg-elevated p-4">
            <h4 className="text-[0.78rem] font-medium uppercase tracking-wide text-muted">
              Daily Trend
            </h4>
            <div className="mt-3">
              <MiniBarChart days={dailyData} />
            </div>
            <div className="mt-2 flex justify-between text-[0.68rem] text-muted">
              <span>{data.daysWithOrders} days with orders</span>
              <span>{data.workingDays - data.daysWithOrders} zero-order days</span>
            </div>
          </div>
        )}

        {/* Order Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total Orders"
            value={String(data.totalOrders)}
            sub={`${data.avgMetresPerOrder.toFixed(0)}m avg`}
          />
          <StatCard
            label="Avg Order Value"
            value={rupees(data.avgOrderValue)}
          />
          <StatCard
            label="GST Orders"
            value={String(data.gstOrders)}
            sub={`${data.gstPct.toFixed(0)}% of total`}
          />
          <StatCard
            label="Best Day"
            value={
              data.bestDay ? rupees(data.bestDay.amount) : "—"
            }
            sub={
              data.bestDay
                ? `${data.bestDay.orders} orders`
                : undefined
            }
          />
        </div>
      </div>

      {/* Section B: Targets for Next Period */}
      <div>
        <h3 className="serif-italic text-lg text-fg">
          Targets for Next Period
        </h3>
        <p className="mt-1 text-[0.78rem] text-muted">
          Based on this period's performance, here's what to aim for.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Target Revenue"
            value={rupees(data.targetAmount)}
            sub="Match this period"
            accent
          />
          <StatCard
            label="Min Lots Needed"
            value={String(data.minLotsNeeded)}
            sub={`at ${rupees(data.avgSalePerLot)}/lot`}
          />
          <StatCard
            label="Target Metres"
            value={metres(data.targetMetres)}
          />
          <StatCard
            label="Orders Needed"
            value={String(data.ordersNeeded)}
            sub={`${data.avgOrdersPerDay.toFixed(1)}/day`}
          />
        </div>
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent-muted p-4">
          <h3 className="serif-italic text-lg text-accent">Insights</h3>
          <ul className="mt-3 space-y-2">
            {data.insights.map((insight, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[0.82rem] text-fg"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Highest Leverage */}
      {data.topLeverage && (
        <div className="rounded-xl border border-border bg-bg-elevated p-4">
          <h3 className="serif-italic text-lg text-fg">Highest Leverage</h3>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-fg">
            {data.topLeverage}
          </p>
        </div>
      )}
    </div>
  );
}
