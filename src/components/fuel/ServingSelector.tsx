"use client";

import { useMemo, useState } from "react";
import { useSheet } from "@/lib/useSheet";
import CountUp from "@/components/motion/CountUp";
import { PencilIcon } from "@/components/fuel/icons";
import EditFoodModal from "@/components/fuel/EditFoodModal";
import {
  CALORIE_COLOR,
  PROTEIN_COLOR,
  CARBS_COLOR,
  FAT_COLOR,
  FIBER_COLOR,
  UNIT_OPTIONS,
  pieceWeightFor,
  scaleMacros,
  servingToGrams,
  type FoodSearchResult,
  type Per100g,
  type ServingUnit,
} from "@/lib/fuel/food";

/** What the caller receives when the user confirms a serving. */
export interface ServingConfirm {
  serving_amount: number;
  serving_unit: ServingUnit;
  serving_g: number;
  /** The (possibly edited) per-100g block, so callers can persist it. */
  per100g: Per100g;
  /** Macros scaled to the chosen serving. */
  macros: Per100g;
}

interface ServingSelectorProps {
  food: FoodSearchResult;
  mealLabel: string;
  /** "add" → "Add to [meal]"; "edit" → "Update entry". */
  mode?: "add" | "edit";
  initialAmount?: number;
  initialUnit?: ServingUnit;
  onClose: () => void;
  onConfirm: (r: ServingConfirm) => Promise<void> | void;
}

const isUnit = (v: string): v is ServingUnit =>
  (UNIT_OPTIONS as readonly string[]).includes(v);

/**
 * The shared serving bottom sheet used by every logging method and by diary
 * edits. Shows the food's name + source badge (with a pencil to correct its
 * nutrition when editable), a large serving input with unit pills, a live
 * count-up nutrition panel, and a confirm button. Nutrition = per100g × grams.
 */
export default function ServingSelector({
  food,
  mealLabel,
  mode = "add",
  initialAmount = 100,
  initialUnit = "g",
  onClose,
  onConfirm,
}: ServingSelectorProps) {
  const { backdropClassName, panelClassName, panelRef, panelStyle, handleProps, handleStyle, close } =
    useSheet(onClose);

  const [amountText, setAmountText] = useState(String(initialAmount));
  const [unit, setUnit] = useState<ServingUnit>(initialUnit);
  const [per100g, setPer100g] = useState<Per100g>(food.per100g);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = Number(amountText) || 0;
  const pieceG = useMemo(() => pieceWeightFor(food.name), [food.name]);
  const grams = servingToGrams(amount, unit, pieceG);
  const macros = useMemo(() => scaleMacros(per100g, grams), [per100g, grams]);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onConfirm({
        serving_amount: amount,
        serving_unit: unit,
        serving_g: grams,
        per100g,
        macros,
      });
    } finally {
      setSaving(false);
    }
  };

  const rows: { label: string; value: number; color: string; size: string; suffix: string }[] = [
    { label: "Calories", value: macros.calories, color: CALORIE_COLOR, size: "text-2xl", suffix: " kcal" },
    { label: "Protein", value: macros.protein_g, color: PROTEIN_COLOR, size: "text-lg", suffix: " g" },
    { label: "Carbs", value: macros.carbs_g, color: CARBS_COLOR, size: "text-lg", suffix: " g" },
    { label: "Fat", value: macros.fat_g, color: FAT_COLOR, size: "text-lg", suffix: " g" },
    { label: "Fiber", value: macros.fiber_g, color: FIBER_COLOR, size: "text-sm", suffix: " g" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`relative flex w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8 ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label={food.name}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full"
          style={{ background: "var(--color-border-strong)", ...handleStyle }}
          aria-hidden
          {...handleProps}
        />

        {/* Header: food name + badge + (optional) edit pencil */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="serif-italic truncate text-2xl leading-tight" data-no-vitality>
              {food.name}
            </h2>
            {food.brand && (
              <p className="mt-0.5 truncate text-[0.8rem] text-muted">{food.brand}</p>
            )}
          </div>
          {food.canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              data-no-vitality
              aria-label="Edit nutrition values"
              className="shrink-0 rounded-full border p-2"
              style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--color-muted-strong)" }}
            >
              <PencilIcon size={16} />
            </button>
          )}
        </div>
        <span
          className="mono mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em]"
          style={{ color: food.badgeColor, border: `1px solid ${food.badgeColor}`, background: "transparent" }}
        >
          {food.badge}
        </span>

        {/* Serving input */}
        <div className="mt-5 flex items-end gap-3">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amountText}
            autoFocus
            onChange={(e) => setAmountText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            className="mono tabular-nums w-32"
            data-no-vitality
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.4rem 0.6rem",
              color: "var(--color-fg)",
              fontSize: "2rem",
            }}
          />
          <span className="mono pb-2 text-sm text-muted">= {Math.round(grams)}g</span>
        </div>

        {/* Unit pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {UNIT_OPTIONS.map((u) => {
            const active = u === unit;
            return (
              <button
                key={u}
                type="button"
                onClick={() => isUnit(u) && setUnit(u)}
                data-no-vitality
                className="rounded-full px-3 py-1.5 text-[0.75rem] font-medium"
                style={{
                  border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                  background: active ? "var(--accent)" : "var(--color-card-elevated)",
                  color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
                }}
              >
                {u}
              </button>
            );
          })}
        </div>
        {unit === "pieces" && (
          <p className="mt-2 text-[0.72rem] text-muted">(1 piece ≈ {pieceG}g)</p>
        )}

        {/* Live nutrition panel */}
        <div
          className="mt-5 rounded-2xl border p-4"
          data-no-vitality
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-1">
              <span className="text-[0.85rem] text-muted-strong">{r.label}</span>
              <span className={`mono tabular-nums ${r.size}`} style={{ color: r.color }}>
                <CountUp value={Math.round(r.value * 10) / 10} decimals={r.label === "Calories" ? 0 : 1} duration={300} restartKey={grams} />
                <span className="text-muted">{r.suffix}</span>
              </span>
            </div>
          ))}
        </div>

        <button type="button" onClick={confirm} disabled={saving} className="btn-primary mt-5 w-full">
          {saving
            ? "Saving…"
            : mode === "edit"
              ? "Update entry"
              : `Add to ${mealLabel} →`}
        </button>
      </div>

      {editing && (
        <EditFoodModal
          foodId={food.id}
          source={food.source}
          per100g={per100g}
          onClose={() => setEditing(false)}
          onSaved={(next) => setPer100g(next)}
        />
      )}
    </div>
  );
}
