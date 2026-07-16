"use client";

import type { LotStatus, LotStock } from "@/lib/supabase/business";

const metres = (n: number): string =>
  `${Math.round(n).toLocaleString("en-IN")}m`;

export const STATUS_LABELS: Record<LotStatus, string> = {
  arrived: "Arrived",
  active: "Active",
  low_stock: "Low Stock",
  cleared: "Cleared",
  dead_stock: "Dead Stock",
};

/** Badge colours per status: mint for healthy, amber for attention, red for
 *  low, muted for finished. */
export function statusColor(status: LotStatus): string {
  switch (status) {
    case "low_stock":
      return "#f87171";
    case "dead_stock":
      return "var(--color-amber)";
    case "cleared":
      return "var(--color-muted)";
    default:
      return "var(--accent)";
  }
}

export function StatusBadge({ status }: { status: LotStatus }) {
  const color = statusColor(status);
  return (
    <span
      className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.12em]"
      style={{ color, borderColor: color }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * The lot stock card shared by the Overview's "Active lots" section and the
 * Lots list page: item name + D.No, days in stock, a status badge, and the
 * three per-component remaining figures. The Lots list adds `showSold` (total
 * metres sold vs opening) and `onOpen` (whole-card tap → detail page).
 */
export default function LotCard({
  lot,
  showSold = false,
  onOpen,
}: {
  lot: LotStock;
  showSold?: boolean;
  onOpen?: () => void;
}) {
  const components: Array<[string, number]> = [
    ["Top", lot.top.remaining],
    ["Bottom", lot.bottom.remaining],
    ["Dupatta", lot.dupatta.remaining],
  ];

  const totalOpening =
    lot.top.opening + lot.bottom.opening + lot.dupatta.opening;
  const totalSold = lot.top.sold + lot.bottom.sold + lot.dupatta.sold;

  const interactive = onOpen
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onOpen,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        },
      }
    : {};

  return (
    <li
      className={`rounded-xl border border-border bg-bg-elevated px-4 py-3${
        onOpen ? " cursor-pointer transition-colors hover:border-mint" : ""
      }`}
      data-no-vitality
      {...interactive}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">
            {lot.itemName}
            {lot.dNo ? (
              <span className="mono ml-2 text-[0.68rem] text-muted">
                {lot.dNo}
              </span>
            ) : null}
          </p>
          <p className="mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
            {lot.daysSince} day{lot.daysSince === 1 ? "" : "s"} in stock
          </p>
        </div>
        {lot.status === "low_stock" && !showSold ? (
          <span
            className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.12em]"
            style={{ color: "#f87171", borderColor: "#f87171" }}
          >
            Low
          </span>
        ) : showSold ? (
          <StatusBadge status={lot.status} />
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {components.map(([name, remaining]) => (
          <div
            key={name}
            className="rounded-lg border border-border px-2.5 py-2 text-center"
          >
            <p className="mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
              {name}
            </p>
            <p
              className="mt-1 text-sm font-semibold tabular-nums"
              style={{
                color: remaining < lot.threshold ? "#f87171" : "var(--accent)",
              }}
            >
              {metres(remaining)}
            </p>
          </div>
        ))}
      </div>

      {showSold ? (
        <p className="mono mt-3 text-[0.68rem] tracking-[0.04em] text-muted">
          <span className="text-muted-strong">{metres(totalSold)}</span> of{" "}
          {metres(totalOpening)} sold
        </p>
      ) : null}
    </li>
  );
}
