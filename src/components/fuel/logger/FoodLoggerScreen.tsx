"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ServingSelector, { type ServingConfirm } from "@/components/fuel/ServingSelector";
import SearchTab from "@/components/fuel/logger/SearchTab";
import BarcodeTab from "@/components/fuel/logger/BarcodeTab";
import MealScanTab from "@/components/fuel/logger/MealScanTab";
import QuickAddTab from "@/components/fuel/logger/QuickAddTab";
import { pushToast } from "@/lib/toast";
import { insertFoodLogs, localISODate, MEAL_TYPES, toMealType, type MealType, type NewFoodLog } from "@/lib/supabase/nutrition";
import type { FoodSearchResult } from "@/lib/fuel/food";

type Tab = "search" | "barcode" | "scan" | "quick";

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "barcode", label: "Barcode" },
  { key: "scan", label: "Meal Scan" },
  { key: "quick", label: "Quick Add" },
];

function mealLabel(type: MealType): string {
  return MEAL_TYPES.find((m) => m.type === type)?.label ?? "Snacks";
}

/** Builds a food_logs insert row from a search result + a chosen serving. */
export function buildLogRow(
  food: FoodSearchResult,
  r: ServingConfirm,
  meal: MealType,
  date: string
): NewFoodLog {
  return {
    logged_date: date,
    meal_type: meal,
    food_source: food.source,
    food_ref_id: food.id || null,
    food_name: food.name,
    brand: food.brand ?? null,
    serving_amount: r.serving_amount,
    serving_unit: r.serving_unit,
    serving_g: r.serving_g,
    calories: r.macros.calories,
    protein_g: r.macros.protein_g,
    fat_g: r.macros.fat_g,
    carbs_g: r.macros.carbs_g,
    fiber_g: r.macros.fiber_g,
  };
}

/**
 * The food logger at /fuel/log?meal=&date=. Four methods (Search / Barcode /
 * Meal Scan / Quick Add) feed a shared serving selector; confirming inserts a
 * food_logs row for the target meal + date, then returns to the diary.
 */
export default function FoodLoggerScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const meal = toMealType(params.get("meal"));
  const date = params.get("date") || localISODate();
  const label = mealLabel(meal);

  const [tab, setTab] = useState<Tab>("search");
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [initialAmount, setInitialAmount] = useState(100);

  const openSelector = (food: FoodSearchResult, amount = 100) => {
    setInitialAmount(amount);
    setSelected(food);
  };

  const commit = async (food: FoodSearchResult, r: ServingConfirm) => {
    try {
      await insertFoodLogs([buildLogRow(food, r, meal, date)]);
      pushToast(`${food.name} added to ${label}`);
      router.push("/fuel");
    } catch {
      pushToast("Couldn't log that. Try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/fuel")}
          data-no-vitality
          aria-label="Back"
          className="rounded-full border p-2"
          style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--color-fg)" }}
        >
          ←
        </button>
        <div>
          <h1 className="serif-italic text-2xl leading-none" data-no-vitality>
            {label}
          </h1>
          <p className="mono mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-muted">{date}</p>
        </div>
      </header>

      {/* method tabs */}
      <div className="mt-5 grid grid-cols-4 gap-1.5">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              data-no-vitality
              className="rounded-full px-2 py-2 text-[0.72rem] font-medium"
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                background: active ? "var(--accent)" : "var(--color-card-elevated)",
                color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "search" && <SearchTab onPick={openSelector} />}
        {tab === "barcode" && <BarcodeTab active={tab === "barcode"} onFound={(f) => openSelector(f)} onQuickAdd={() => setTab("quick")} />}
        {tab === "scan" && <MealScanTab meal={meal} date={date} mealLabel={label} onReviewOne={openSelector} onManual={() => setTab("quick")} />}
        {tab === "quick" && <QuickAddTab mealLabel={label} onAdd={commit} />}
      </div>

      {selected && (
        <ServingSelector
          food={selected}
          mealLabel={label}
          mode="add"
          initialAmount={initialAmount}
          onClose={() => setSelected(null)}
          onConfirm={(r) => commit(selected, r)}
        />
      )}
    </div>
  );
}
