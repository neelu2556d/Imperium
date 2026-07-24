"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { fetchSalesRows, type SalesRow } from "@/lib/supabase/orders";
import { fetchAllLots } from "@/lib/supabase/lots";
import type { LotStock } from "@/lib/supabase/business";
import ReportPerDay from "./ReportPerDay";
import ReportPartyWise from "./ReportPartyWise";
import ReportItemWise from "./ReportItemWise";
import ReportDeepAnalysis from "./ReportDeepAnalysis";
import {
  type Period,
  type SubTab,
  PERIODS,
  SUB_TABS,
  shiftPeriod,
  periodLabel,
  filterByPeriod,
  generateExportText,
  triggerExport,
} from "./reportUtils";

/**
 * /business/reports — The Reports page. Period selector (Monthly / Quarterly /
 * Half-Yearly / Yearly), date range navigator, and 4 sub-tab report views.
 * All 4 reports share the same selected period.
 */
export default function ReportsScreen() {
  const [orders, setOrders] = useState<SalesRow[] | null>(null);
  const [lots, setLots] = useState<LotStock[] | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [subTab, setSubTab] = useState<SubTab>("per_day");
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSalesRows(), fetchAllLots()]).then(([o, l]) => {
      if (!cancelled) {
        setOrders(o);
        setLots(l);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => (orders ? filterByPeriod(orders, cursor, period) : null),
    [orders, cursor, period]
  );

  const handleExport = () => {
    if (!orders || !lots) return;
    const text = generateExportText(orders, lots, cursor, period, subTab);
    const label = periodLabel(cursor, period).replace(/\s+/g, "-").toLowerCase();
    triggerExport(text, `report-${subTab}-${label}.txt`);
  };

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Reports
        </h2>
        <button
          type="button"
          className="btn-primary"
          disabled={!filtered || filtered.length === 0}
          onClick={handleExport}
        >
          <Download size={15} aria-hidden />
          Export
        </button>
      </div>

      {/* Period selector — large pills */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map(({ key, label }) => {
          const active = period === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => setPeriod(key)}
              className="shrink-0 rounded-full border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      borderColor: "var(--accent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--color-muted-strong)",
                      borderColor: "var(--color-border)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Date range navigator */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          data-no-vitality
          aria-label="Previous period"
          onClick={() => setCursor((c) => shiftPeriod(c, period, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-mint hover:text-fg"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="mono min-w-[10rem] text-center text-sm font-medium tabular-nums text-fg">
          {periodLabel(cursor, period)}
        </span>
        <button
          type="button"
          data-no-vitality
          aria-label="Next period"
          onClick={() => setCursor((c) => shiftPeriod(c, period, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-mint hover:text-fg"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Sub-tab selector */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SUB_TABS.map(({ key, label }) => {
          const active = subTab === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => setSubTab(key)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-[0.78rem] font-medium transition-colors"
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      borderColor: "var(--accent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--color-muted-strong)",
                      borderColor: "var(--color-border)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Report content */}
      {orders === null || lots === null ? (
        <div className="mt-6 space-y-4">
          <div className="h-20 animate-pulse rounded-xl border border-border bg-bg-elevated" />
          <div className="h-48 animate-pulse rounded-xl border border-border bg-bg-elevated" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-bg-elevated" />
        </div>
      ) : filtered === null ? null : (
        <div className="mt-6">
          {subTab === "per_day" && (
            <ReportPerDay rows={filtered} cursor={cursor} period={period} />
          )}
          {subTab === "party_wise" && (
            <ReportPartyWise rows={filtered} />
          )}
          {subTab === "item_wise" && (
            <ReportItemWise rows={filtered} lots={lots} />
          )}
          {subTab === "deep_analysis" && (
            <ReportDeepAnalysis
              rows={filtered}
              lots={lots}
              cursor={cursor}
              period={period}
            />
          )}
        </div>
      )}
    </div>
  );
}
