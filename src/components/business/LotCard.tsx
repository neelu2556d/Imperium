"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
      return "var(--color-danger)";
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
 *
 * When `onEdit` and `onDelete` are provided, a three-dot menu appears with
 * those actions.
 */
export default function LotCard({
  lot,
  showSold = false,
  onOpen,
  onEdit,
  onDelete,
}: {
  lot: LotStock;
  showSold?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

  const actionsVisible = Boolean(onEdit || onDelete);

  return (
    <li
      className={`rounded-xl border border-border bg-bg-elevated px-4 py-3${
        onOpen ? " cursor-pointer transition-colors hover:border-mint" : ""
      }`}
      data-no-vitality
      {...interactive}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
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
        <div className="flex items-center gap-2">
          {lot.status === "low_stock" && !showSold ? (
            <span
              className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.12em]"
              style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
            >
              Low
            </span>
          ) : showSold ? (
            <StatusBadge status={lot.status} />
          ) : null}
          {actionsVisible && <ActionMenu onEdit={onEdit} onDelete={onDelete} />}
        </div>
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
                color: remaining < lot.threshold ? "var(--color-danger)" : "var(--accent)",
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

// ---------------------------------------------------------------------------
// Three-dot action menu (overflow)
// ---------------------------------------------------------------------------

function ActionMenu({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-no-vitality
        aria-label="More actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-muted-strong hover:bg-white/[0.05] hover:text-fg"
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border shadow-lg"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "var(--color-bg-elevated)",
          }}
        >
          {onEdit && (
            <button
              type="button"
              data-no-vitality
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-sm text-fg hover:bg-white/[0.05]"
            >
              <Pencil size={14} aria-hidden />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              data-no-vitality
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-sm hover:bg-white/[0.05]"
              style={{ color: "var(--color-danger)" }}
            >
              <Trash2 size={14} aria-hidden />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
