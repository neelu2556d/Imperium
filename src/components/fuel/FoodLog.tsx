"use client";

import FoodLogRow from "@/components/fuel/FoodLogRow";
import type { FoodLog as FoodLogEntry } from "@/lib/supabase/nutrition";

interface FoodLogProps {
  items: FoodLogEntry[];
  totalCalories: number;
  onDelete: (id: string) => void;
}

/**
 * Section 2 — today's food log. A "TODAY" header with the running calorie total
 * right-aligned, then the list of logged rows (each expandable + swipe/long-
 * press to delete). Shows an empty-state card when nothing is logged yet.
 */
export default function FoodLog({
  items,
  totalCalories,
  onDelete,
}: FoodLogProps) {
  return (
    <section
      className="rounded-2xl border p-5"
      data-no-vitality
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-strong">
          Today
        </h2>
        <span className="mono text-sm tabular-nums text-muted-strong">
          {Math.round(totalCalories)}
          <span className="text-muted"> kcal</span>
        </span>
      </header>

      {items.length === 0 ? (
        <div
          className="mt-4 flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center"
          style={{ borderColor: "var(--color-border-strong)" }}
        >
          <p className="text-sm font-medium">Nothing logged yet.</p>
          <p className="text-[0.8rem] text-muted">Add your first meal.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <FoodLogRow key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
