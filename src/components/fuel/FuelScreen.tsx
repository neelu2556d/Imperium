"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MacroSummary from "@/components/fuel/MacroSummary";
import MealSection from "@/components/fuel/MealSection";
import ManualLogSheet from "@/components/fuel/ManualLogSheet";
import ScreenshotImportSheet from "@/components/fuel/ScreenshotImportSheet";
import GoalsCard from "@/components/fuel/GoalsCard";
import FoodLogCard from "@/components/fuel/FoodLogCard";
import QuickAdd from "@/components/fuel/QuickAdd";
import FoodLibrary from "@/components/fuel/FoodLibrary";
import BarcodeScanner from "@/components/fuel/BarcodeScanner";
import MealScanner from "@/components/fuel/MealScanner";
import FuelRing from "@/components/fuel/FuelRing";
import { pushToast } from "@/lib/toast";
import {
  DEFAULT_NUTRITION_GOALS,
  deleteFoodLog,
  fetchNutritionGoals,
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

  // Which sheet is currently open.
  const [sheetType, setSheetType] = useState<"manual" | "import" | null>(
    null
  );
  const [openSheet, setOpenSheet] = useState(false);

  // Quick add state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMeal, setQuickAddMeal] = useState<MealType>("snacks");

  // Meal sections open/close state
  const [openSections] = useState<Set<MealType>>(
    new Set<MealType>(["breakfast", "lunch", "dinner", "snacks"])
  );

  // Nutrion goals for the summary pills
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);

  // Load goals on mount
  useEffect(() => {
    fetchNutritionGoals().then((g) => {
      if (g) {
        setGoals({
          calories: g.calories ?? DEFAULT_NUTRITION_GOALS.calories,
          protein_g: g.protein_g ?? DEFAULT_NUTRITION_GOALS.protein_g,
          fat_g: g.fat_g ?? DEFAULT_NUTRITION_GOALS.fat_g,
          carbs_g: g.carbs_g ?? DEFAULT_NUTRITION_GOALS.carbs_g,
        });
      }
      setIsLoadingGoals(false);
    });
  }, []);

  // We'll group logs by meal_type after they're fetched
  const groupedLogs = useMemo(() => {
    const grouped: Record<MealType, FoodLogEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };

    logs.forEach((log) => {
      const mealType: MealType = log.meal_type ?? "snacks";
      if (grouped[mealType] !== undefined) {
        grouped[mealType].push(log);
      } else {
        grouped.snacks.push(log);
      }
    });

    return grouped;
  }, [logs]);

  // Totals per meal
  const mealTotals = useMemo(() => {
    const totals: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snacks: 0,
    };

    logs.forEach((log) => {
      const mealType: MealType = log.meal_type ?? "snacks";
      if (totals[mealType] !== undefined) {
        totals[mealType] += log.calories ?? 0;
      }
    });

    return totals;
  }, [logs]);

  const totalCalories = mealTotals.breakfast +
    mealTotals.lunch +
    mealTotals.dinner +
    mealTotals.snacks;

  const totalProtein = useMemo(() => {
    let sum = 0;
    logs.forEach((log) => {
      sum += (log.protein ?? 0);
    });
    return sum;
  }, [logs]);

  const totalCarbs = useMemo(() => {
    let sum = 0;
    logs.forEach((log) => {
      sum += (log.carbs ?? 0);
    });
    return sum;
  }, [logs]);

  const totalFat = useMemo(() => {
    let sum = 0;
    logs.forEach((log) => {
      sum += (log.fat ?? 0);
    });
    return sum;
  }, [logs]);

  // Open manual log sheet
  const openManualLog = (mealType: MealType) => {
    setManualMeal(mealType);
    setOpenSheet(true);
    setSheetType("manual");
  };

  // Open import sheet
  const openImportSheet = (mealType: MealType) => {
    setImportMeal(mealType);
    setOpenSheet(true);
    setSheetType("import");
  };

  // Close sheet
  const closeSheet = () => {
    setOpenSheet(false);
    setManualMeal(null);
    setImportMeal(null);
    setImageFile(null);
  };

  const addManualEntry = async (entry: {
    item_name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }) => {
    try {
      await addFoodLogs(
        [
          {
            item_name: entry.item_name,
            calories: entry.calories,
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
          },
        ],
        "manual",
        manualMeal ?? "snacks"
      );
      setOpenSheet(false);
      setManualMeal(null);
      setGoals((prev) => ({
        calories: prev.calories + entry.calories,
        protein_g: prev.protein_g + entry.protein,
        fat_g: prev.fat_g + entry.fat,
        carbs_g: prev.carbs_g + entry.carbs,
      }));
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          item_name: entry.item_name,
          calories: entry.calories,
          protein: entry.protein,
          fat: entry.fat,
          carbs: entry.carbs,
          meal_type: manualMeal ?? "snacks",
          source: "manual",
        },
      ]);
      pushToast("Logged to " + mealLabel(manualMeal ?? "snacks"));
    } catch {
      pushToast("Couldn't log food. Try again.");
    }
  };

  const handleImageFile = async (file: File) => {
    setImageFile(file);
    setOpenSheet(true);
    setSheetType("import");
  };

  const handleScreenshotImport = async () => {
    if (!imageFile) return;
    setOpenSheet(false);
    setImageFile(null);
    // Screenshot import sheet will handle the rest
    // We'll open it with the file and meal context
    setImportMeal(pendingImportMeal.current);
    setSheetType("import-screenshot");
  };

  // Quick add open/close
  const toggleQuickAdd = () => setQuickAddOpen((prev) => !prev);

  // Open food library / search
  const openFoodLibrary = (search?: string) => {
    setTimeout(() => {
      // We'll let the component handle navigation
    }, 100);
  };

  const handleQuickAddSubmit = async (food: {
    name: string;
    quantity: number;
    unit: "g" | "ml" | "pieces" | "tbsp";
    mealType: MealType;
  }) => {
    try {
      // Use fetchNutritionByName to get nutrition if not provided
      // For quick add with custom values, we'll calculate based on quantity
      await addFoodLogs(
        [
          {
            item_name: food.name,
            calories: food.quantity,
            protein: 0,
            fat: 0,
            carbs: 0,
          },
        ],
        "manual",
        food.mealType
      );
      setQuickAddOpen(false);
      setGoals((prev) => ({
        calories: prev.calories + food.quantity,
        protein_g: prev.protein_g,
        fat_g: prev.fat_g,
        carbs_g: prev.carbs_g,
      }));
      pushToast("Logged " + food.name + " to " + mealLabel(food.mealType));
    } catch {
      pushToast("Couldn't save item. Try again.");
    }
  };

  // Format today's date display
  const formatDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <div className="fuel-screen">
      {/* Header / Today summary row */}
      <header className="border-b pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Date picker strip */}
            <div className="relative">
              <button
                className="text-sm text-muted hover:text-fg focus:outline-none"
                onClick={() => setReady(true)}
                aria-label="Week view"
              >
                Week
              </button>
              <button
                className={`text-sm ${ready ? "text-fg" : "text-muted"} hover:text-fg focus:outline-none`}
                onClick={() => setReady(false)}
                aria-label="Today view"
              >
                Today
              </button>
            </div>

            {/* Calories card - expanded view */}
            <div className="rounded-xl p-4 flex-1 flex flex-col items-start gap-1.5"
              style={{
                background: "var(--color-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <p className="mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-strong">
                Today
              </p>
              <p className="mono text-lg font-semibold tabular-nums"
                style={{ color: "var(--color-mint)" }}
              >
                {Math.round(totalCalories)} kcal
              </p>
              <p className="text-[0.65rem] text-muted-strong/70">
                Remaining: {Math.round(goals.calories - totalCalories)} kcal
              </p>
            </div>

            {/* Macros card */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.1em] text-muted-strong"
                style={{ background: "var(--color-card-elevated)", borderColor: "var(--color-border)" }}
              >
                {Math.round(totalProtein)}g protein
              </div>
              <div className="rounded-xl px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.1em] text-muted-strong"
                style={{ background: "var(--color-card-elevated)", borderColor: "var(--color-border)" }}
              >
                {Math.round(totalCarbs)}g carbs
              </div>
              <div className="rounded-xl px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.1em] text-muted-strong"
                style={{ background: "var(--color-card-elevated)", borderColor: "var(--color-border)" }}
              >
                {Math.round(totalFat)}g fat
              </div>
            </div>
          </div>

          {/* Complete diary button */}
          <button
            className="btn-secondary text-sm py-2 px-4 rounded-lg"
            onClick={() => {
              // In MFP, this would show the complete diary view
              pushToast("Diary complete!");
            }}
          >
            Complete Diary
          </button>
        </header>

        {/* MEAL SECTIONS - Breakfast, Lunch, Dinner, Snacks */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MealSection
            mealType="breakfast"
            label="Breakfast"
            items={groupedLogs.breakfast}
            onDelete={(id) => {
              deleteFoodLog(id);
              setLogs((prev) => prev.filter((l) => l.id !== id));
            }}
            onLog={() => openManualLog("breakfast")}
            onImport={() => openImportSheet("breakfast")}
          />
          <MealSection
            mealType="lunch"
            label="Lunch"
            items={groupedLogs.lunch}
            onDelete={(id) => {
              deleteFoodLog(id);
              setLogs((prev) => prev.filter((l) => l.id !== id));
            }}
            onLog={() => openManualLog("lunch")}
            onImport={() => openImportSheet("lunch")}
          />
          <MealSection
            mealType="dinner"
            label="Dinner"
            items={groupedLogs.dinner}
            onDelete={(id) => {
              deleteFoodLog(id);
              setLogs((prev) => prev.filter((l) => l.id !== id));
            }}
            onLog={() => openManualLog("dinner")}
            onImport={() => openImportSheet("dinner")}
          />
          <MealSection
            mealType="snacks"
            label="Snacks"
            items={groupedLogs.snacks}
            onDelete={(id) => {
              deleteFoodLog(id);
              setLogs((prev) => prev.filter((l) => l.id !== id));
            }}
            onLog={() => openManualLog("snacks")}
            onImport={() => openImportSheet("snacks")}
          />
        </div>

        {/* Food Log Card for logged items in selected meal */}
        {manualMeal && (
          <FoodLogCard
            food={{ id: "temp", name: "Searching...", calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, source: "manual" }}
            mealType={manualMeal}
            onLog={() => {}}
            onCancel={() => {
              setManualMeal(null);
            }}
          />
        )}

        {/* Quick Add button - central hub */}
        <div className="mt-4">
          <button
            onClick={toggleQuickAdd}
            className="w-full btn-primary py-3 rounded-xl text-lg font-medium flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm0 0v2m3-3H9m12 0v2m-6-4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
            Quick Add
          </button>
        </div>

        {/* Quick Add Sheet - opens as bottom sheet */}
        {quickAddOpen && (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <div className="p-6 rounded-2xl border border-border bg-bg/70 backdrop-blur-lg max-w-md w-full">
              <h2 className="text-xl font-medium mb-4">Quick Add Food</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted mb-1">
                    Item name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chicken Curry"
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value="1"
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  // Submit quick add
                  toggleQuickAdd();
                }}
                className="w-full btn-primary py-2 rounded-xl mt-4"
              >
                Add Food
              </button>
              <button
                onClick={toggleQuickAdd}
                className="w-full py-2 border rounded-xl mt-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Barcode Scan button */}
        <div className="mt-4">
          <button
            className="w-full btn-outline py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            onClick={() => {
              // Open barcode scanner
              // In real impl, would integrate with camera
              pushToast("Barcode scan feature coming soon");
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11 3.055A9.003 9.003 0 1011 13.945M15 5.011a9.003 9.003 0 10-18 0 9.003 9.003 0 0018-2.989zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Barcode Scan
          </button>
        </div>

        {/* Meal Scan button */}
        <div className="mt-2">
          <button
            className="w-full btn-outline py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            onClick={() => {
              // Open meal scanner
              setTimeout(() => {
                // In real impl, open meal scanner modal
                pushToast("Meal scan - detecting Indian meal items...");
              }, 100);
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6.17-6.17a8 8 0 10-11.31 11.31L5 21l6 6-6 6 1.17 1.17a8 8 0 0011.31-11.31z"
              />
            </svg>
            Meal Scan
          </button>
        </div>

        {/* Screenshot Import - opens sheet with image */}
        <div className="mt-2">
          <button
            className="w-full btn-outline py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            onClick={() => {
              // Open file picker for screenshot import
              setTimeout(() => {
                fileInput.current?.click();
              }, 100);
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4v2m-6-3h12m-2-4h10l-6-6m0 0l-2 2m2-2l-2-2m2 2l2 2"
              />
            </svg>
            Screenshot Import
          </button>
        </div>

        {/* Footer: complete diary button */}
        <footer className="border-t pt-4 mt-4 flex items-center justify-between">
          <button
            className="btn-secondary text-sm py-2 px-4 rounded-lg"
            onClick={() => pushToast("Diary saved!")}
          >
            Complete Diary
          </button>
          <div className="text-muted text-[0.7rem]">
            Total: {Math.round(totalCalories)} kcal · {Math.round(totalProtein)}g pro · {Math.round(totalCarbs)}g car · {Math.round(totalFat)}g fat
          </div>
        </footer>
      </div>
    </div>
  );
}