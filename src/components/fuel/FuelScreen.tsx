"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MacroSummary from "@/components/fuel/MacroSummary";
import FoodLog from "@/components/fuel/FoodLog";
import AddFood from "@/components/fuel/AddFood";
import GoalsCard from "@/components/fuel/GoalsCard";
import {
  DEFAULT_NUTRITION_GOALS,
  deleteFoodLog,
  fetchNutritionGoals,
  fetchTodayFoodLogs,
  type FoodLog as FoodLogEntry,
  type NutritionGoals,
} from "@/lib/supabase/nutrition";

/**
 * The /fuel tab. Owns the day's state — macro goals + today's food logs — so
 * the hero ring, stat pills, and log list all update live from a single source
 * as meals are added or removed. Sections are otherwise self-contained.
 */
export default function FuelScreen() {
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS);
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [ready, setReady] = useState(false);

  const loadLogs = useCallback(() => fetchTodayFoodLogs().then(setLogs), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, items] = await Promise.all([
        fetchNutritionGoals().catch(() => null),
        fetchTodayFoodLogs(),
      ]);
      if (cancelled) return;
      if (g) setGoals(g);
      setLogs(items);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live totals recomputed whenever the log list changes.
  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          protein: acc.protein + l.protein,
          carbs: acc.carbs + l.carbs,
          fat: acc.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [logs]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const prev = logs;
      setLogs((cur) => cur.filter((l) => l.id !== id)); // optimistic
      try {
        await deleteFoodLog(id);
      } catch {
        setLogs(prev); // roll back on failure
      }
    },
    [logs]
  );

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="mb-6">
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
          Daily nutrition
        </p>
        <h1 className="serif-italic mt-1 text-4xl leading-tight" data-no-vitality>
          Fuel
        </h1>
      </header>

      <div
        className="flex flex-col gap-4"
        style={{ opacity: ready ? 1 : 0.6, transition: "opacity 200ms" }}
      >
        <MacroSummary totals={totals} goals={goals} />
        <FoodLog
          items={logs}
          totalCalories={totals.calories}
          onDelete={handleDelete}
        />
        <AddFood onLogged={loadLogs} />
        <GoalsCard goals={goals} />
      </div>
    </div>
  );
}
