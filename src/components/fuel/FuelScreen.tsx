"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DateNavigator from "@/components/fuel/DateNavigator";
import CaloriesCard from "@/components/fuel/CaloriesCard";
import MacrosCard from "@/components/fuel/MacrosCard";
import MealSection from "@/components/fuel/MealSection";
import ProgressView from "@/components/fuel/ProgressView";
import ServingSelector, { type ServingConfirm } from "@/components/fuel/ServingSelector";
import { pushToast } from "@/lib/toast";
import type { FoodSearchResult, ServingUnit } from "@/lib/fuel/food";
import {
  DEFAULT_NUTRITION_GOALS,
  deleteFoodLog,
  fetchFoodLogs,
  fetchNutritionGoals,
  localISODate,
  MEAL_TYPES,
  updateFoodLog,
  type FoodLog,
  type MealType,
  type NutritionGoals,
} from "@/lib/supabase/nutrition";

type View = "today" | "progress";

/** Rebuilds a FoodSearchResult from a logged row so the serving selector can
 *  re-open it in edit mode (per-100g back-computed from the entry's serving). */
function logToFood(item: FoodLog): FoodSearchResult {
  const g = item.serving_g || 100;
  const per = (v: number) => (g > 0 ? (v / g) * 100 : v);
  return {
    id: item.food_ref_id ?? item.id,
    name: item.food_name,
    brand: item.brand,
    food_group: null,
    source: item.food_source,
    badge: item.food_source === "custom" ? "My Foods" : "Logged",
    badgeColor: "#6EE7B7",
    per100g: {
      calories: per(item.calories),
      protein_g: per(item.protein_g),
      fat_g: per(item.fat_g),
      carbs_g: per(item.carbs_g),
      fiber_g: per(item.fiber_g),
    },
    canEdit: item.food_source === "indian" || item.food_source === "custom",
  };
}

function mealLabel(type: MealType): string {
  return MEAL_TYPES.find((m) => m.type === type)?.label ?? "Snacks";
}

/**
 * The /fuel tab. Two top-level views — Today (date-navigated diary with calorie
 * + macro cards and four meal sections) and Progress (charts over day/week/
 * month) — toggled by pill tabs. Today owns the selected date, its logs, and
 * the goals, so the cards and sections update live as entries change.
 */
export default function FuelScreen() {
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(() => localISODate());
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [editing, setEditing] = useState<FoodLog | null>(null);

  const loadLogs = useCallback(
    (date: string) => fetchFoodLogs(date).then(setLogs),
    []
  );

  useEffect(() => {
    fetchNutritionGoals()
      .then((g) => g && setGoals(g))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchFoodLogs(selectedDate).then((rows) => {
      if (!cancelled) setLogs(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (a, l) => ({
          calories: a.calories + l.calories,
          protein: a.protein + l.protein_g,
          carbs: a.carbs + l.carbs_g,
          fat: a.fat + l.fat_g,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [logs]
  );

  const byMeal = useMemo(() => {
    const groups: Record<MealType, FoodLog[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    for (const l of logs) groups[l.meal_type].push(l);
    return groups;
  }, [logs]);

  const handleDelete = useCallback(
    async (id: string) => {
      const prev = logs;
      setLogs((cur) => cur.filter((l) => l.id !== id));
      try {
        await deleteFoodLog(id);
      } catch {
        setLogs(prev);
        pushToast("Couldn't delete that entry.");
      }
    },
    [logs]
  );

  const handleUpdate = useCallback(
    async (entry: FoodLog, r: ServingConfirm) => {
      const patch = {
        serving_amount: r.serving_amount,
        serving_unit: r.serving_unit,
        serving_g: r.serving_g,
        calories: r.macros.calories,
        protein_g: r.macros.protein_g,
        fat_g: r.macros.fat_g,
        carbs_g: r.macros.carbs_g,
        fiber_g: r.macros.fiber_g,
      };
      setLogs((cur) => cur.map((l) => (l.id === entry.id ? { ...l, ...patch } : l)));
      setEditing(null);
      try {
        await updateFoodLog(entry.id, patch);
        pushToast("Entry updated");
      } catch {
        loadLogs(selectedDate);
        pushToast("Couldn't update that entry.");
      }
    },
    [loadLogs, selectedDate]
  );

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 md:max-w-lg md:px-8">
      <header className="pt-8">
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Daily nutrition</p>
        <h1 className="serif-italic mt-1 text-4xl leading-tight" data-no-vitality>
          Fuel
        </h1>
      </header>

      {/* view toggle */}
      <div className="mt-5 flex gap-2">
        {(["today", "progress"] as View[]).map((v) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              data-no-vitality
              className="flex-1 rounded-full px-4 py-2 text-[0.82rem] font-medium capitalize"
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                background: active ? "var(--accent)" : "var(--color-card-elevated)",
                color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      {view === "today" ? (
        <>
          <div className="mt-3">
            <DateNavigator selected={selectedDate} onSelect={setSelectedDate} />
          </div>

          <div className="mt-3 flex flex-col gap-4">
            <CaloriesCard consumed={totals.calories} goal={goals.calories} />
            <MacrosCard
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
              goalProtein={goals.protein_g}
              goalCarbs={goals.carbs_g}
              goalFat={goals.fat_g}
            />
            {MEAL_TYPES.map((m) => (
              <MealSection
                key={m.type}
                mealType={m.type}
                label={m.label}
                items={byMeal[m.type]}
                date={selectedDate}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4">
          <ProgressView selectedDate={selectedDate} goals={goals} />
        </div>
      )}

      {editing && (
        <ServingSelector
          food={logToFood(editing)}
          mealLabel={mealLabel(editing.meal_type)}
          mode="edit"
          initialAmount={editing.serving_amount}
          initialUnit={editing.serving_unit as ServingUnit}
          onClose={() => setEditing(null)}
          onConfirm={(r) => handleUpdate(editing, r)}
        />
      )}
    </div>
  );
}
