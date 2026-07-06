"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon, TrashIcon } from "@/components/fuel/icons";
import { PROTEIN_COLOR, CARBS_COLOR, FAT_COLOR } from "@/components/fuel/FuelRing";
import type { FoodLog } from "@/lib/supabase/nutrition";

interface FoodLogRowProps {
  item: FoodLog;
  onDelete: (id: string) => void;
}

const LONG_PRESS_MS = 550;

/**
 * A single logged-food row. Tapping the row (or its chevron) expands a
 * three-column protein/carbs/fat breakdown. Deletion is available two ways, per
 * spec: a long-press on the row, or a swipe-left that reveals a trash affordance
 * (also surfaced as a button inside the expanded panel). Deletes are optimistic
 * — the parent removes the row immediately.
 */
export default function FoodLogRow({ item, onDelete }: FoodLogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragX, setDragX] = useState(0); // negative = swiped left
  const [dragging, setDragging] = useState(false); // pointer currently down
  const [armed, setArmed] = useState(false); // long-press reached threshold

  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    setDragging(true);
    setArmed(false);
    timer.current = setTimeout(() => {
      if (!moved.current) {
        // long-press: reveal the delete affordance (same as a full swipe)
        setArmed(true);
        setDragX(-72);
      }
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) {
      moved.current = true;
      clearTimer();
    }
    // Only track leftward swipe, clamped.
    setDragX(Math.max(-96, Math.min(0, dx)));
  };

  const endGesture = () => {
    clearTimer();
    setDragging(false);
    if (armed) {
      // Long-press already parked the row open; keep it there.
      startX.current = null;
      return;
    }
    // A far-enough swipe parks the row open on the delete affordance.
    setDragX(dragX <= -64 ? -72 : 0);
    startX.current = null;
  };

  const onClick = () => {
    // A tap (not a drag) toggles the breakdown; snap any open swipe back first.
    if (moved.current || dragX !== 0) {
      setDragX(0);
      setArmed(false);
      return;
    }
    setExpanded((v) => !v);
  };

  const macros = [
    { label: "Protein", value: item.protein, color: PROTEIN_COLOR },
    { label: "Carbs", value: item.carbs, color: CARBS_COLOR },
    { label: "Fat", value: item.fat, color: FAT_COLOR },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* delete layer revealed by a left swipe */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={`Delete ${item.item_name}`}
        data-no-vitality
        className="absolute inset-y-0 right-0 flex items-center justify-center border-0"
        style={{
          width: 72,
          background: "var(--color-red)",
          color: "#fff",
          borderRadius: 0,
        }}
      >
        <TrashIcon size={18} />
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onClick={onClick}
        className="relative cursor-pointer select-none touch-pan-y"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 220ms var(--ease-DEFAULT)",
          background: "var(--color-card-elevated)",
          border: armed
            ? "1px solid var(--color-red)"
            : "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <ChevronDownIcon
            size={16}
            className="shrink-0 text-muted transition-transform"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {item.item_name}
          </span>
          <span className="mono shrink-0 text-sm tabular-nums text-muted-strong">
            {Math.round(item.calories)}
            <span className="text-muted"> kcal</span>
          </span>
        </div>

        {expanded && (
          <div
            className="grid grid-cols-3 gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            {macros.map((m) => (
              <div key={m.label} className="flex flex-col items-center">
                <span className="text-[0.62rem] uppercase tracking-[0.1em] text-muted">
                  {m.label}
                </span>
                <span
                  className="mono mt-1 text-sm tabular-nums"
                  style={{ color: m.color }}
                >
                  {Math.round(m.value)}g
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              data-no-vitality
              className="col-span-3 mt-1 flex items-center justify-center gap-2 text-[0.72rem]"
              style={{
                border: "1px solid var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-muted-strong)",
                padding: "0.4rem",
              }}
            >
              <TrashIcon size={14} /> Delete entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
