"use client";

import { useRef, useState } from "react";
import { TrashIcon } from "@/components/fuel/icons";
import { PROTEIN_COLOR, CARBS_COLOR, FAT_COLOR } from "@/lib/fuel/food";
import type { FoodLog } from "@/lib/supabase/nutrition";

interface DiaryRowProps {
  item: FoodLog;
  onEdit: (item: FoodLog) => void;
  onDelete: (id: string) => void;
}

/**
 * A logged-food row on the diary. Tapping opens the serving selector pre-filled
 * to edit the entry; a left swipe parks the row open on a red Delete button.
 * Deleting fades + slides the row out (200ms) before the parent drops it.
 */
export default function DiaryRow({ item, onEdit, onDelete }: DiaryRowProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    setDragX(Math.max(-96, Math.min(0, dx)));
  };
  const endGesture = () => {
    setDragging(false);
    setDragX(dragX <= -64 ? -72 : 0);
    startX.current = null;
  };
  const onClick = () => {
    if (moved.current || dragX !== 0) {
      setDragX(0);
      return;
    }
    onEdit(item);
  };

  const remove = () => {
    setRemoving(true);
    setTimeout(() => onDelete(item.id), 200);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        maxHeight: removing ? 0 : 200,
        opacity: removing ? 0 : 1,
        transform: removing ? "translateX(-24px)" : "none",
        transition: "opacity 200ms, transform 200ms, max-height 220ms 40ms, margin 200ms",
        marginBottom: removing ? 0 : undefined,
      }}
    >
      <button
        type="button"
        onClick={remove}
        aria-label={`Delete ${item.food_name}`}
        data-no-vitality
        className="absolute inset-y-0 right-0 flex items-center justify-center border-0"
        style={{ width: 72, background: "var(--color-red)", color: "var(--color-fg)", borderRadius: 0 }}
      >
        <TrashIcon size={18} />
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onClick={onClick}
        className="relative cursor-pointer select-none touch-pan-y px-4 py-3"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 220ms var(--ease-DEFAULT)",
          background: "var(--color-card-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-[0.95rem] font-medium">
            {item.food_name}
          </span>
          <span className="mono shrink-0 text-sm tabular-nums text-muted-strong">
            {Math.round(item.calories)}
            <span className="text-muted"> kcal</span>
          </span>
        </div>
        <p className="mono mt-1 text-[0.72rem] text-muted">
          {Math.round(item.serving_g)}g · P:{Math.round(item.protein_g)}g{" "}
          <span style={{ color: CARBS_COLOR }}>C:{Math.round(item.carbs_g)}g</span>{" "}
          <span style={{ color: PROTEIN_COLOR }}>·</span>{" "}
          <span style={{ color: FAT_COLOR }}>F:{Math.round(item.fat_g)}g</span>
        </p>
      </div>
    </div>
  );
}
