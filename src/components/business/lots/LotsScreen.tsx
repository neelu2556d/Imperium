"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import LotCard from "@/components/business/LotCard";
import NewLotSheet from "@/components/business/lots/NewLotSheet";
import EditLotSheet from "@/components/business/lots/EditLotSheet";
import { fetchAllLots, deleteLot } from "@/lib/supabase/lots";
import { pushToast } from "@/lib/toast";
import type { LotStatus, LotStock } from "@/lib/supabase/business";

type Filter = "all" | LotStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "arrived", label: "Arrived" },
  { key: "active", label: "Active" },
  { key: "low_stock", label: "Low Stock" },
  { key: "cleared", label: "Cleared" },
  { key: "dead_stock", label: "Dead Stock" },
];

/**
 * The Lots pill's default view: heading + "+ New Lot", a scrollable status
 * filter row, and the lot card list (shared LotCard, with sold-vs-opening
 * shown). Tapping a card routes to /business/lots/[lot_id]; "+ New Lot" opens
 * the 3-step entry bottom sheet. Each card also has an overflow menu with
 * Edit and Delete actions.
 */
export default function LotsScreen() {
  const router = useRouter();
  const [lots, setLots] = useState<LotStock[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Edit / delete state
  const [editLot, setEditLot] = useState<LotStock | null>(null);
  const [deleteLotId, setDeleteLotId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetchAllLots().then(setLots);
  }, []);

  useEffect(load, [load]);

  const visible =
    lots?.filter((l) => filter === "all" || l.status === filter) ?? null;

  const handleDelete = async () => {
    if (!deleteLotId || deleting) return;
    setDeleting(true);
    try {
      const { orderCount } = await deleteLot(deleteLotId);
      pushToast(
        orderCount > 0
          ? `Lot deleted. ${orderCount} order(s) disconnected.`
          : "Lot deleted."
      );
      setDeleteLotId(null);
      load();
    } catch {
      pushToast("Couldn't delete the lot. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const deletedLot = deleteLotId
    ? lots?.find((l) => l.lotId === deleteLotId)
    : null;

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Lots
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={15} aria-hidden />
          New Lot
        </button>
      </div>

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
        <ul className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {filter === "all"
            ? "No lots yet. Log your first arrival with + New Lot."
            : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} lots.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((lot) => (
            <LotCard
              key={lot.lotId}
              lot={lot}
              showSold
              onOpen={() => router.push(`/business/lots/${lot.lotId}`)}
              onEdit={() => setEditLot(lot)}
              onDelete={() => setDeleteLotId(lot.lotId)}
            />
          ))}
        </ul>
      )}

      {sheetOpen && (
        <NewLotSheet
          onClose={() => setSheetOpen(false)}
          onSaved={(lotId) => {
            setSheetOpen(false);
            router.push(`/business/lots/${lotId}`);
          }}
        />
      )}

      {editLot && (
        <EditLotSheet
          lot={editLot}
          onClose={() => setEditLot(null)}
          onSaved={() => {
            setEditLot(null);
            load();
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteLotId && deletedLot && (
        <ConfirmDelete
          title={deletedLot.itemName}
          subtitle={
            deletedLot.dNo
              ? `${deletedLot.dNo} · ${STATUS_LABELS[deletedLot.status]}`
              : STATUS_LABELS[deletedLot.status]
          }
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteLotId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<LotStatus, string> = {
  arrived: "Arrived",
  active: "Active",
  low_stock: "Low Stock",
  cleared: "Cleared",
  dead_stock: "Dead Stock",
};

function ConfirmDelete({
  title,
  subtitle,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-xl"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
        role="alertdialog"
        aria-label="Delete lot"
      >
        <p className="text-lg font-semibold text-fg">Delete &ldquo;{title}&rdquo;?</p>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--color-danger)" }}>
          This will remove the lot and its photos. Any orders logged against
          this lot will remain but will no longer be linked to it.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            className="btn-primary w-full"
            style={{
              background: "var(--color-danger)",
              color: "#fff",
              borderColor: "transparent",
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete lot"}
          </button>
          <button
            type="button"
            data-no-vitality
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-full border bg-transparent px-4 py-2.5 text-sm font-medium"
            style={{
              borderColor: "var(--color-border-strong)",
              color: "var(--color-fg)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
