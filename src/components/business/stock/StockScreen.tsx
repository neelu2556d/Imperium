"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/business/LotCard";
import { fetchAllLots } from "@/lib/supabase/lots";
import type {
  LotComponentStock,
  LotStatus,
  LotStock,
} from "@/lib/supabase/business";

type Filter = "all" | "active" | "low_stock" | "dead_stock";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All Lots" },
  { key: "active", label: "Active" },
  { key: "low_stock", label: "Low Stock" },
  { key: "dead_stock", label: "Dead Stock" },
];

/** Below this many metres remaining a component is critical regardless of the
 *  lot's own low-stock threshold. */
const DANGER_METRES = 50;

const metres = (n: number): string =>
  `${Math.round(n).toLocaleString("en-IN")}m`;

/** "03 July 2026" for the arrived line. */
function arrivedDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Bar / figure colour: danger under 50m, amber below the lot threshold,
 *  mint when healthy. */
function stockColor(remaining: number, threshold: number): string {
  if (remaining < DANGER_METRES) return "var(--color-danger)";
  if (remaining < threshold) return "var(--color-amber)";
  return "var(--accent)";
}

/** Sort weight: attention-needing lots first, cleared last. Sort is stable, so
 *  lots keep their newest-first order within a group. */
const SORT_RANK: Record<LotStatus, number> = {
  low_stock: 0,
  dead_stock: 1,
  active: 2,
  arrived: 2,
  cleared: 3,
};

/**
 * /business/stock — the Stock Register. Live remaining metres per lot, read
 * from the `stock_register` view via {@link fetchAllLots}. A status filter row
 * and one card per lot (photo, per-component opening/sold/remaining table, and
 * a progress bar per component). Cards are ordered low-stock first; tapping one
 * opens that lot's detail page.
 */
export default function StockScreen() {
  const router = useRouter();
  const [lots, setLots] = useState<LotStock[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchAllLots().then((data) => {
      if (!cancelled) setLots(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (lots === null) return null;
    const matched = lots.filter((l) => {
      if (filter === "all") return true;
      if (filter === "active")
        return l.status === "active" || l.status === "arrived";
      return l.status === filter;
    });
    return [...matched].sort(
      (a, b) => SORT_RANK[a.status] - SORT_RANK[b.status]
    );
  }, [lots, filter]);

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
        Stock Register
      </h2>

      {/* status filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => setFilter(key)}
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

      {visible === null ? (
        <ul className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-border bg-bg-elevated"
            />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {filter === "all"
            ? "No lots yet. Log a lot arrival to start tracking stock."
            : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} right now.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((lot) => (
            <StockCard
              key={lot.lotId}
              lot={lot}
              onOpen={() => router.push(`/business/lots/${lot.lotId}`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function StockCard({ lot, onOpen }: { lot: LotStock; onOpen: () => void }) {
  const components: Array<{ label: string; short: string; comp: LotComponentStock }> = [
    { label: "Top", short: "Top", comp: lot.top },
    { label: "Bottom", short: "Bot", comp: lot.bottom },
    { label: "Dupatta", short: "Dup", comp: lot.dupatta },
  ];

  return (
    <li
      role="button"
      tabIndex={0}
      data-no-vitality
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-2xl border border-border bg-bg-elevated px-4 py-4 transition-colors hover:border-mint"
    >
      {/* header: photo + title + status */}
      <div className="flex items-start gap-3">
        <Thumb url={lot.designPhotoUrl} alt={lot.dNo || lot.itemName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-fg">
              {lot.itemName}
              {lot.dNo ? (
                <span className="mono ml-2 text-[0.68rem] text-muted">
                  {lot.dNo}
                </span>
              ) : null}
            </p>
            <StatusBadge status={lot.status} />
          </div>
          <p className="mono mt-1 text-[0.66rem] uppercase tracking-[0.14em] text-muted">
            Arrived: {arrivedDate(lot.dateArrived)}
          </p>
        </div>
      </div>

      {/* per-component table */}
      <table className="mono mt-4 w-full text-[0.74rem] tabular-nums">
        <thead>
          <tr className="text-[0.58rem] uppercase tracking-[0.12em] text-muted">
            <th className="pb-1.5 text-left font-normal">Component</th>
            <th className="pb-1.5 text-right font-normal">Opening</th>
            <th className="pb-1.5 text-right font-normal">Sold</th>
            <th className="pb-1.5 text-right font-normal">Remaining</th>
            <th className="pb-1.5 text-right font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {components.map(({ label, comp }) => {
            const pct = comp.opening > 0 ? (comp.remaining / comp.opening) * 100 : 0;
            return (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 text-left text-muted-strong">{label}</td>
                <td className="py-1.5 text-right text-muted-strong">
                  {metres(comp.opening)}
                </td>
                <td className="py-1.5 text-right text-muted-strong">
                  {metres(comp.sold)}
                </td>
                <td
                  className="py-1.5 text-right font-semibold"
                  style={{ color: stockColor(comp.remaining, lot.threshold) }}
                >
                  {metres(comp.remaining)}
                </td>
                <td className="py-1.5 text-right text-muted-strong">
                  {Math.max(0, Math.round(pct))}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* progress bars */}
      <div className="mt-4 space-y-2">
        {components.map(({ short, comp }) => (
          <StockBar
            key={short}
            label={short}
            comp={comp}
            threshold={lot.threshold}
          />
        ))}
      </div>
    </li>
  );
}

function StockBar({
  label,
  comp,
  threshold,
}: {
  label: string;
  comp: LotComponentStock;
  threshold: number;
}) {
  const pct =
    comp.opening > 0
      ? Math.max(0, Math.min(100, (comp.remaining / comp.opening) * 100))
      : 0;
  const color = stockColor(comp.remaining, threshold);

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--color-card-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="mono w-24 shrink-0 text-right text-[0.64rem] uppercase tracking-[0.1em] text-muted">
        {label} {Math.round(pct)}% left
      </span>
    </div>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (url) {
    return (
      <div
        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border"
        style={{ background: "var(--color-card)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="mono flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border text-[0.6rem] uppercase tracking-[0.1em] text-muted"
      style={{ background: "var(--color-card)" }}
      aria-hidden
    >
      No
      <br />
      photo
    </div>
  );
}
