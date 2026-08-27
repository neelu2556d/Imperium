"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/fuel/icons";
import DiaryRow from "@/components/fuel/DiaryRow";
import type { FoodLog, MealType } from "@/lib/supabase/nutrition";

interface MealSectionProps {
  mealType: MealType;
  label: string;
  items: FoodLog[];
  /** The diary date, forwarded to the logger link. */
  date: string;
  onEdit: (item: FoodLog) => void;
  onDelete: (id: string) => void;
}

/**
 * An expandable meal card on the Today view. Header shows the meal name and its
 * calorie subtotal; expanded it lists the logged rows. A "+ Log food" ghost
 * pill always sits at the bottom, linking to the logger for this meal + date.
 */
export default function MealSection({
  mealType,
  label,
  items,
  date,
  onEdit,
  onDelete,
}: MealSectionProps) {
  const [open, setOpen] = useState(true);
  const subtotal = items.reduce((sum, it) => sum + it.calories, 0);

  return (
    <section
      className="rounded-2xl border p-4"
      data-no-vitality
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-no-vitality
        className="flex w-full items-center justify-between"
        style={{ background: "transparent", border: "none", padding: 0 }}
      >
        <span className="flex items-center gap-2">
          <ChevronDownIcon
            size={16}
            className="shrink-0 text-muted transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="serif-italic text-lg" data-no-vitality>
            {label}
          </span>
        </span>
        <span className="mono text-sm tabular-nums text-muted-strong">
          {Math.round(subtotal)}
          <span className="text-muted"> kcal</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <DiaryRow key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      <Link
        href={`/fuel/log?meal=${mealType}&date=${date}`}
        className="mono mt-3 flex items-center justify-center rounded-full px-3 py-2 text-[0.75rem]"
        data-no-vitality
        style={{
          border: "1px dashed var(--color-border-strong)",
          background: "transparent",
          color: "var(--color-muted-strong)",
        }}
      >
        + Log food
      </Link>
    </section>
  );
}
