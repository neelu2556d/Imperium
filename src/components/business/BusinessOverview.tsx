"use client";

import { useEffect, useState } from "react";
import LotCard from "@/components/business/LotCard";
import {
  fetchOverview,
  generateBriefing,
  type LotStock,
  type OverdueEntry,
  type OverviewData,
} from "@/lib/supabase/business";

/** ₹ with Indian digit grouping; whole rupees (paise aren't tracked here). */
const rupees = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Compact ₹ for headline KPIs: ₹1.2L / ₹3.4Cr so tiles never overflow. */
function rupeesShort(n: number): string {
  const v = Math.round(n);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString("en-IN")}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: OverviewData };

export default function BusinessOverview() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchOverview().then((data) => {
      if (!cancelled) setState({ status: "ready", data });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = state.status === "ready" ? state.data : null;

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      {/* 1 — headline KPIs */}
      <KpiGrid data={data} loading={state.status === "loading"} />

      {/* 2 — morning briefing. Keyed on the briefing id so the card remounts
          with the loaded briefing once the async fetch resolves — no in-effect
          state sync needed. */}
      <BriefingCard
        key={data?.briefing?.id ?? "none"}
        initial={data?.briefing?.content ?? null}
      />

      {/* 3 — overdue collections */}
      <OverdueSection
        entries={data?.overdue.entries ?? []}
        totalCount={data?.overdue.totalCount ?? 0}
        loading={state.status === "loading"}
      />

      {/* 4 — active lot stock */}
      <ActiveLotsSection
        lots={data?.activeLots ?? []}
        loading={state.status === "loading"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — KPI grid
// ---------------------------------------------------------------------------

function KpiGrid({
  data,
  loading,
}: {
  data: OverviewData | null;
  loading: boolean;
}) {
  const sales = data?.sales;
  const salesSub =
    sales == null
      ? "—"
      : sales.pctChange == null
        ? `vs ${rupeesShort(sales.lastMonth)} last month`
        : `${sales.delta >= 0 ? "▲" : "▼"} ${Math.abs(
            Math.round(sales.pctChange)
          )}% vs last month`;

  return (
    <section className="grid grid-cols-2 gap-3">
      <KpiCard
        label="Sales · this month"
        value={loading ? "…" : rupeesShort(sales?.thisMonth ?? 0)}
        sub={loading ? "" : salesSub}
        tone={sales && sales.delta < 0 ? "warn" : "accent"}
      />
      <KpiCard
        label="Outstanding"
        value={loading ? "…" : rupeesShort(data?.outstanding.total ?? 0)}
        sub={
          loading
            ? ""
            : `${data?.outstanding.invoiceCount ?? 0} open invoice${
                (data?.outstanding.invoiceCount ?? 0) === 1 ? "" : "s"
              }`
        }
      />
      <KpiCard
        label="Active lots"
        value={loading ? "…" : String(data?.lots.active ?? 0)}
        sub={
          loading
            ? ""
            : `${data?.lots.lowStock ?? 0} low · ${data?.lots.deadStock ?? 0} dead`
        }
        tone={data && data.lots.lowStock > 0 ? "warn" : "accent"}
      />
      <KpiCard
        label="Orders · this month"
        value={loading ? "…" : String(data?.orders.count ?? 0)}
        sub={loading ? "" : `${data?.orders.partiesVisited ?? 0} parties`}
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "accent",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "accent" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated px-4 py-4">
      <p className="mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-semibold tabular-nums md:text-3xl"
        style={{ color: tone === "warn" ? "var(--color-danger)" : "var(--accent)" }}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2 — Morning briefing
// ---------------------------------------------------------------------------

function BriefingCard({ initial }: { initial: string | null }) {
  const [text, setText] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The briefing is manual-only: it's read (from today's already-generated
  // entry, if any) on mount, but never auto-generated. The user taps
  // Generate/Regenerate to produce one — so opening the Overview never spends
  // an API call.
  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const reply = await generateBriefing();
      setText(reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate a briefing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-border bg-bg-elevated px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="serif-italic text-xl md:text-2xl"
          data-no-vitality
        >
          Morning briefing
        </h2>
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          data-no-vitality
          className="rounded-full border px-3.5 py-1.5 text-[0.72rem] font-medium transition-colors disabled:opacity-50"
          style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
        >
          {busy ? "Thinking…" : text ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : text ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-strong">
          {text}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No briefing yet. Generate one for a read on today&apos;s priorities —
          collections to chase, stock to move, momentum vs last month.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3 — Overdue collections
// ---------------------------------------------------------------------------

function OverdueSection({
  entries,
  totalCount,
  loading,
}: {
  entries: OverdueEntry[];
  totalCount: number;
  loading: boolean;
}) {
  return (
    <section className="mt-6">
      <SectionHeader
        title="Overdue collections"
        count={loading ? undefined : totalCount}
      />
      {loading ? (
        <SkeletonRows />
      ) : entries.length === 0 ? (
        <EmptyRow>Nothing overdue — collections are current.</EmptyRow>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {e.partyName}
                </p>
                <p className="mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  {e.daysOverdue} day{e.daysOverdue === 1 ? "" : "s"} overdue
                </p>
              </div>
              <p
                className="shrink-0 text-sm font-semibold tabular-nums"
                style={{ color: "var(--color-danger)" }}
              >
                {rupees(e.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4 — Active lot stock
// ---------------------------------------------------------------------------

function ActiveLotsSection({
  lots,
  loading,
}: {
  lots: LotStock[];
  loading: boolean;
}) {
  return (
    <section className="mt-6">
      <SectionHeader
        title="Active lots"
        count={loading ? undefined : lots.length}
      />
      {loading ? (
        <SkeletonRows />
      ) : lots.length === 0 ? (
        <EmptyRow>No active lots. Log a lot arrival to start tracking.</EmptyRow>
      ) : (
        <ul className="mt-3 space-y-2">
          {lots.map((lot) => (
            <LotCard key={lot.lotId} lot={lot} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="serif-italic text-xl md:text-2xl" data-no-vitality>
        {title}
      </h2>
      {count != null ? (
        <span className="mono text-[0.7rem] text-muted">{count}</span>
      ) : null}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

function SkeletonRows() {
  return (
    <ul className="mt-3 space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-16 animate-pulse rounded-xl border border-border bg-bg-elevated"
        />
      ))}
    </ul>
  );
}
