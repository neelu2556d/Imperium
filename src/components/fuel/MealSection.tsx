"use client";

import FoodLogRow from "@/components/fuel/FoodLogRow";
import { EditPlusIcon, ImageIcon } from "@/components/fuel/icons";
import type { FoodLog, MealType } from "@/lib/supabase/nutrition";

interface MealSectionProps {
  mealType: MealType;
  label: string;
  items: FoodLog[];
  onDelete: (id: string) => void;
  /** Open the manual-log sheet targeting this meal. */
  onLog: (mealType: MealType) => void;
  /** Open the screenshot importer targeting this meal. */
  onImport: (mealType: MealType) => void;
}

/**
 * One meal section on the /fuel tab — Breakfast / Lunch / Dinner / Snacks. Shows
 * the meal name with its running calorie subtotal, the logged rows for that meal
 * (reusing FoodLogRow's expand + swipe/long-press delete), an empty hint, and
 * its own "Log manually" + "Import screenshot" actions so an import drops
 * straight into this meal.
 */
export default function MealSection({
  mealType,
  label,
  items,
  onDelete,
  onLog,
  onImport,
}: MealSectionProps) {
  const subtotal = items.reduce((sum, it) => sum + it.calories, 0);

  return (
    <section
      className="rounded-2xl border p-4"
      data-no-vitality
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <header className="flex items-baseline justify-between px-1">
        <h2 className="mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-strong">
          {label}
        </h2>
        <span className="mono text-sm tabular-nums text-muted-strong">
          {Math.round(subtotal)}
          <span className="text-muted"> kcal</span>
        </span>
      </header>

      {items.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <FoodLogRow key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onLog(mealType)}
          data-no-vitality
          aria-label={`Log ${label} manually`}
          className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[0.78rem] font-medium transition-transform active:scale-[0.98]"
          style={actionStyle}
        >
          <span style={{ color: "var(--color-mint)" }}>
            <EditPlusIcon size={16} />
          </span>
          Log
        </button>
        <button
          type="button"
          onClick={() => onImport(mealType)}
          data-no-vitality
          aria-label={`Import a screenshot into ${label}`}
          className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[0.78rem] font-medium transition-transform active:scale-[0.98]"
          style={actionStyle}
        >
          <span style={{ color: "var(--color-mint)" }}>
            <ImageIcon size={16} />
          </span>
          Import
        </button>
      </div>
    </section>
  );
}

const actionStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-card-elevated)",
  color: "var(--color-fg)",
};
