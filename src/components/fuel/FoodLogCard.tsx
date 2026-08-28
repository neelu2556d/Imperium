"use client";

import { useState, useEffect, useMemo } from "react";
import { insertFoodLogs } from "@/lib/supabase/nutrition";
import type { MealType } from "@/lib/supabase/nutrition";
import type { FoodSearchResult } from "@/lib/fuel/food";

type QuantityUnit = "g" | "ml" | "pieces" | "tbsp";

interface FoodLogCardProps {
  food: FoodSearchResult;
  mealType: MealType;
  onLog: () => void;
  onCancel: () => void;
  defaultQuantity?: number;
  defaultUnit?: QuantityUnit;
}

const UNITS: { value: QuantityUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "pieces", label: "pieces" },
  { value: "tbsp", label: "tbsp" },
];

// Conversion factors to 100g equivalent (for display calculation)
const UNIT_TO_G: Record<QuantityUnit, number> = {
  g: 1,
  ml: 1, // assuming 1ml ≈ 1g for most liquids
  pieces: 30, // average piece weight in grams (can be customized)
  tbsp: 15, // average tablespoon weight in grams
};

export default function FoodLogCard({
  food,
  mealType,
  onLog,
  onCancel,
  defaultQuantity = 100,
  defaultUnit = "g",
}: FoodLogCardProps) {
  const [quantity, setQuantity] = useState(String(defaultQuantity));
  const [unit, setUnit] = useState<QuantityUnit>(defaultUnit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate nutritional values based on quantity
  const calculatedNutrition = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const factor = (qty * UNIT_TO_G[unit]) / 100;

    return {
      calories: Math.round(food.per100g.calories * factor),
      protein_g: Math.round(food.per100g.protein_g * factor * 10) / 10,
      carbs_g: Math.round(food.per100g.carbs_g * factor * 10) / 10,
      fat_g: Math.round(food.per100g.fat_g * factor * 10) / 10,
    };
  }, [quantity, unit, food]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty, numbers, and decimals
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setQuantity(val);
    }
  };

  const quickQuantityButtons = [25, 50, 100, 150, 200, 250];

  const handleLog = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const today = new Date().toISOString().split("T")[0];
      await insertFoodLogs([
        {
          logged_date: today,
          meal_type: mealType,
          food_source: "manual",
          food_name: food.name,
          brand: food.brand,
          serving_amount: 1,
          serving_unit: "g",
          serving_g: 100,
          calories: calculatedNutrition.calories,
          protein_g: calculatedNutrition.protein_g,
          fat_g: calculatedNutrition.fat_g,
          carbs_g: calculatedNutrition.carbs_g,
          fiber_g: 0,
        },
      ]);
      onLog();
    } catch (err) {
      setError("Couldn't log food. Try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Food name header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{food.name}</h3>
        {food.brand && (
          <p className="text-sm text-muted">{food.brand}</p>
        )}
      </div>

      {/* Quantity selector */}
      <div className="mb-4">
        <label className="block text-[0.7rem] uppercase tracking-[0.1em] text-muted mb-2">
          Quantity
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={quantity}
            onChange={handleQuantityChange}
            className="mono text-lg tabular-nums flex-1 border rounded-lg px-3 py-2.5"
            style={{
              background: "var(--color-card-elevated)",
              borderColor: "var(--color-border)",
            }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as QuantityUnit)}
            className="border rounded-lg px-3 py-2.5"
            style={{
              background: "var(--color-card-elevated)",
              borderColor: "var(--color-border)",
            }}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quick quantity buttons */}
        <div className="flex flex-wrap gap-2 mt-2">
          {quickQuantityButtons.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setQuantity(String(qty))}
              className="px-3 py-1 text-sm rounded-full border transition-transform active:scale-95"
              style={{
                background: quantity === String(qty) ? "var(--color-mint)" : "var(--color-card-elevated)",
                borderColor: "var(--color-border)",
                color: quantity === String(qty) ? "var(--color-bg)" : "var(--color-fg)",
              }}
            >
              {qty}{unit}
            </button>
          ))}
        </div>
      </div>

      {/* Nutrition preview */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: "var(--color-card-elevated)" }}
      >
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted mb-1">
              Calories
            </p>
            <p className="mono text-lg font-semibold" style={{ color: "var(--color-mint)" }}>
              {calculatedNutrition.calories}
            </p>
            <p className="text-[0.6rem] text-muted">kcal</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted mb-1">
              Protein
            </p>
            <p className="mono text-lg font-semibold" style={{ color: "var(--color-mint)" }}>
              {calculatedNutrition.protein_g}
            </p>
            <p className="text-[0.6rem] text-muted">g</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted mb-1">
              Carbs
            </p>
            <p className="mono text-lg font-semibold" style={{ color: "var(--color-amber)" }}>
              {calculatedNutrition.carbs_g}
            </p>
            <p className="text-[0.6rem] text-muted">g</p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted mb-1">
              Fat
            </p>
            <p className="mono text-lg font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
              {calculatedNutrition.fat_g}
            </p>
            <p className="text-[0.6rem] text-muted">g</p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm mb-3" style={{ color: "var(--color-red)" }}>
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border transition-colors"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "transparent",
            color: "var(--color-muted-strong)",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleLog}
          disabled={saving || !quantity}
          className="flex-1 btn-primary py-3 rounded-xl"
        >
          {saving ? "Logging…" : "Log Food"}
        </button>
      </div>
    </div>
  );
}