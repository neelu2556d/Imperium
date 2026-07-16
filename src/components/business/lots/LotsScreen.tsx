"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import LotCard from "@/components/business/LotCard";
import NewLotSheet from "@/components/business/lots/NewLotSheet";
import { fetchAllLots } from "@/lib/supabase/lots";
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
 * the 3-step entry bottom sheet.
 */
export default function LotsScreen() {
  const router = useRouter();
  const [lots, setLots] = useState<LotStock[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    fetchAllLots().then(setLots);
  }, []);

  useEffect(load, [load]);

  const visible =
    lots?.filter((l) => filter === "all" || l.status === filter) ?? null;

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
    </div>
  );
}
