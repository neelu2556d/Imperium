"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MacroSummary from "@/components/fuel/MacroSummary";
import MealSection from "@/components/fuel/MealSection";
import ManualLogSheet from "@/components/fuel/ManualLogSheet";
import ScreenshotImportSheet from "@/components/fuel/ScreenshotImportSheet";
import GoalsCard from "@/components/fuel/GoalsCard";
import { pushToast } from "@/lib/toast";
import {
  DEFAULT_NUTRITION_GOALS,
  deleteFoodLog,
  fetchNutritionGoals,
  fetchTodayFoodLogs,
  MEAL_TYPES,
  type FoodLog as FoodLogEntry,
  type MealType,
  type NutritionGoals,
} from "@/lib/supabase/nutrition";

/** The label for a meal type, e.g. "breakfast" → "Breakfast". */
function mealLabel(type: MealType): string {
  return MEAL_TYPES.find((m) => m.type === type)?.label ?? "Snacks";
}

/**
 * The /fuel tab. Owns the day's state — macro goals + today's food logs — so
 * the hero ring, stat pills, and the four meal sections all update live from a
 * single source as meals are added or removed. Logs are grouped by meal_type;
 * each section logs/imports straight into its own meal via screen-level sheet
 * state (which meal + which sheet is open).
 */
export default function FuelScreen() {
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS);
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [ready, setReady] = useState(false);

  // Which meal a sheet targets, and which sheet (if any) is open.
  const [manualMeal, setManualMeal] = useState<MealType | null>(null);
  const [importMeal, setImportMeal] = useState<MealType | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Remembers which meal the pending file picker is filling.
  const pendingImportMeal = useRef<MealType>("snacks");

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

  // Group today's logs into their meal sections (order per MEAL_TYPES).
  const byMeal = useMemo(() => {
    const groups: Record<MealType, FoodLogEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    for (const l of logs) groups[l.meal_type].push(l);
    return groups;
  }, [logs]);

  const handleDelete = useCallback(
    async (id: string) => {
      const prev = logs;
      setLogs((cur) => cur.filter((l) => l.id !== id)); // optimistic
      try {
        await deleteFoodLog(id);
      } catch {
        setLogs(prev); // roll back on failure
        pushToast("Couldn't delete that entry. Try again.");
      }
    },
    [logs]
  );

  // A meal's "Import" button remembers the meal, then opens the device picker.
  const openImport = useCallback((meal: MealType) => {
    pendingImportMeal.current = meal;
    fileInput.current?.click();
  }, []);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (file) {
      setImportMeal(pendingImportMeal.current);
      setImageFile(file);
    }
  };

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

        {MEAL_TYPES.map((m) => (
          <MealSection
            key={m.type}
            mealType={m.type}
            label={m.label}
            items={byMeal[m.type]}
            onDelete={handleDelete}
            onLog={setManualMeal}
            onImport={openImport}
          />
        ))}

        <GoalsCard goals={goals} />
      </div>

      {/* Shared hidden picker. No `capture` attr so the browser shows its full
          picker (Photo Library / Files) rather than jumping to the camera. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        className="hidden"
      />

      {manualMeal && (
        <ManualLogSheet
          mealType={manualMeal}
          mealLabel={mealLabel(manualMeal)}
          onClose={() => setManualMeal(null)}
          onLogged={loadLogs}
        />
      )}

      {imageFile && importMeal && (
        <ScreenshotImportSheet
          file={imageFile}
          mealType={importMeal}
          mealLabel={mealLabel(importMeal)}
          onClose={() => {
            setImageFile(null);
            setImportMeal(null);
          }}
          onLogged={loadLogs}
          onFallbackManual={() => setManualMeal(importMeal)}
        />
      )}
    </div>
  );
}
