"use client";

import { useState } from "react";
import { saveCustomFood } from "@/lib/fuel/api";
import type { ServingConfirm } from "@/components/fuel/ServingSelector";
import {
  pieceWeightFor,
  servingToGrams,
  UNIT_OPTIONS,
  type FoodSearchResult,
  type ServingUnit,
} from "@/lib/fuel/food";

interface QuickAddTabProps {
  mealLabel: string;
  onAdd: (food: FoodSearchResult, r: ServingConfirm) => Promise<void> | void;
}

const toNum = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Quick Add — free-form entry. All macro fields are FOR THE SERVING entered
 * (not per-100g); we back-compute per-100g values for storage. Optionally saves
 * the food to custom_foods ("My Foods") so it appears in future searches.
 */
export default function QuickAddTab({ mealLabel, onAdd }: QuickAddTabProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<ServingUnit>("g");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fiber, setFiber] = useState("");
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);

  const canAdd = name.trim().length > 0 && toNum(cals) > 0 && !busy;

  const submit = async () => {
    if (!canAdd) return;
    setBusy(true);
    const amt = toNum(amount) || 1;
    const grams = servingToGrams(amt, unit, pieceWeightFor(name)) || 1;
    const servingMacros = {
      calories: toNum(cals),
      protein_g: toNum(protein),
      fat_g: toNum(fat),
      carbs_g: toNum(carbs),
      fiber_g: toNum(fiber),
    };
    const factor = 100 / grams;
    const per100g = {
      calories: servingMacros.calories * factor,
      protein_g: servingMacros.protein_g * factor,
      fat_g: servingMacros.fat_g * factor,
      carbs_g: servingMacros.carbs_g * factor,
      fiber_g: servingMacros.fiber_g * factor,
    };

    if (save) {
      await saveCustomFood({
        name: name.trim(),
        per100g,
        defaultServingG: grams,
        defaultUnit: unit,
      });
    }

    const food: FoodSearchResult = {
      id: "",
      name: name.trim(),
      brand: null,
      food_group: null,
      source: "quick_add",
      badge: "Quick Add",
      badgeColor: "#6EE7B7",
      per100g,
      canEdit: false,
    };
    await onAdd(food, {
      serving_amount: amt,
      serving_unit: unit,
      serving_g: grams,
      per100g,
      macros: servingMacros,
    });
    setBusy(false);
  };

  const field = (label: string, value: string, set: (v: string) => void, big = false) => (
    <label className="flex flex-col gap-1.5">
      <span className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        placeholder="0"
        onChange={(e) => set(e.target.value)}
        className={`mono tabular-nums ${big ? "text-2xl" : ""}`}
        data-no-vitality
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.55rem 0.7rem", color: "var(--color-fg)" }}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">Food name</span>
        <input
          type="text"
          value={name}
          placeholder="e.g. Protein shake"
          onChange={(e) => setName(e.target.value)}
          data-no-vitality
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.6rem 0.7rem", color: "var(--color-fg)" }}
        />
      </label>

      <div>
        <span className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">Serving size</span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mono tabular-nums w-24"
            data-no-vitality
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.55rem 0.7rem", color: "var(--color-fg)" }}
          />
          <div className="flex flex-wrap gap-1.5">
            {UNIT_OPTIONS.map((u) => {
              const active = u === unit;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  data-no-vitality
                  className="rounded-full px-2.5 py-1 text-[0.7rem]"
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
        </div>
      </div>

      {field("Calories (for this serving)", cals, setCals, true)}
      <div className="grid grid-cols-2 gap-3">
        {field("Protein (g)", protein, setProtein)}
        {field("Fat (g)", fat, setFat)}
        {field("Carbs (g)", carbs, setCarbs)}
        {field("Fiber (g)", fiber, setFiber)}
      </div>

      <label className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
        <span className="text-[0.85rem] text-muted-strong">Save to My Foods</span>
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
      </label>

      <button type="button" onClick={submit} disabled={!canAdd} className="btn-primary w-full">
        {busy ? "Adding…" : `Add to ${mealLabel} →`}
      </button>
    </div>
  );
}
