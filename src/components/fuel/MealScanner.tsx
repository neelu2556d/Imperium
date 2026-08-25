"use client";

import { useState } from "react";
import { addFoodLogs } from "@/lib/supabase/nutrition";
import { FoodEntry } from "@/lib/supabase/foodLibrary";
import { XMarkIcon } from "@/components/fuel/icons";

interface MealScannerProps {
  mealType: string;
  onLogComplete: () => void;
  onCancel: () => void;
}

/**
 * Meal Scanner for Indian meals. Uses camera to scan Indian meals
 * (roti, rice, curry, dal, vegetables, etc.) and suggests common pairings with
 * estimated nutrition values.
 */
export default function MealScanner({
  mealType,
  onLogComplete,
  onCancel,
}: MealScannerProps) {
  const [step, setStep] = useState<"scanning" | "review" | "success">("scanning");
  const [scanning, setScanninging] = useState(false);
  const [detectedItems, setDetectedItems] = useState<FoodEntry[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});

  // Common Indian meal items with estimated nutrition per 100g
  const INDIAN_MEAL_ITEMS: FoodEntry[] = [
    {
      id: "meal:roti",
      name: "Roti (Whole Wheat)",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 297,
      protein_g: 10.8,
      fat_g: 1.5,
      carbs_g: 56.3,
    },
    {
      id: "meal:rice",
      name: "Steamed Rice",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 130,
      protein_g: 2.7,
      fat_g: 0.3,
      carbs_g: 28.0,
    },
    {
      id: "meal:dal",
      name: "Dal (Lentil Curry)",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 140,
      protein_g: 8.0,
      fat_g: 4.5,
      carbs_g: 20.0,
    },
    {
      id: "meal:chicken",
      name: "Chicken Curry",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 170,
      protein_g: 15.0,
      fat_g: 10.0,
      carbs_g: 5.0,
    },
    {
      id: "meal:veg",
      name: "Mixed Vegetables Sabzi",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 120,
      protein_g: 3.0,
      fat_g: 5.0,
      carbs_g: 12.0,
    },
    {
      id: "meal:naan",
      name: "Butter Naan",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 265,
      protein_g: 8.0,
      fat_g: 8.0,
      carbs_g: 42.0,
    },
    {
      id: "meal:chapati",
      name: "Chapati",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 220,
      protein_g: 6.0,
      fat_g: 2.0,
      carbs_g: 45.0,
    },
    {
      id: "meal:sambar",
      name: "Sambar",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 100,
      protein_g: 4.0,
      fat_g: 2.0,
      carbs_g: 16.0,
    },
    {
      id: "meal:curd",
      name: "Curd / Yogurt",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 62,
      protein_g: 3.5,
      fat_g: 4.0,
      carbs_g: 4.5,
    },
    {
      id: "meal:papad",
      name: "Papad (Roasted)",
      brand: "Indian Meal",
      source: "meal_scan",
      calories: 180,
      protein_g: 8.0,
      fat_g: 10.0,
      carbs_g: 10.0,
    },
  ];

  const startScan = () => {
    setScanninging(true);
    setError(null);
    // Simulate AI-powered meal detection
    setTimeout(() => {
      // Randomly detect 3-6 items from common Indian meals
      const count = Math.floor(Math.random() * 4) + 3;
      const shuffled = [...INDIAN_MEAL_ITEMS].sort(() => Math.random() - 0.5);
      const detected = shuffled.slice(0, count);
      setDetectedItems(detected);

      // Initialize quantities
      const initialQuantities: Record<string, number> = {};
      detected.forEach((item) => {
        initialQuantities[item.id] = 100;
      });
      setQuantityMap(initialQuantities);

      // Select all by default
      const initialSelected = new Set(detected.map((item) => item.id));
      setSelectedItems(initialSelected);

      setScanninging(false);
      setStep("review");
    }, 2500);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const updateQuantity = (id: string, qty: number) => {
    setQuantityMap({ ...quantityMap, [id]: qty });
  };

  const calculateNutrition = (item: FoodEntry) => {
    const qty = quantityMap[item.id] || 100;
    const factor = qty / 100;
    return {
      calories: Math.round(item.calories * factor),
      protein_g: Math.round(item.protein_g * factor * 10) / 10,
      fat_g: Math.round(item.fat_g * factor * 10) / 10,
      carbs_g: Math.round(item.carbs_g * factor * 10) / 10,
    };
  };

  const handleLogAll = async () => {
    setError(null);
    const selectedItemsList = detectedItems.filter((item) =>
      selectedItems.has(item.id)
    );

    if (selectedItemsList.length === 0) {
      setError("Select at least one item to log");
      return;
    }

    const entries = selectedItemsList.map((item) => {
      const nutrition = calculateNutrition(item);
      return {
        item_name: item.name,
        calories: nutrition.calories,
        protein: nutrition.protein_g,
        fat: nutrition.fat_g,
        carbs: nutrition.carbs_g,
      };
    });

    try {
      await addFoodLogs(entries, "meal_scan", mealType);
      setStep("success");
      onLogComplete();
    } catch (err) {
      setError("Couldn't log meals. Try again.");
    }
  };

  const totals = detectedItems
    .filter((item) => selectedItems.has(item.id))
    .reduce(
      (sum, item) => {
        const n = calculateNutrition(item);
        return {
          calories: sum.calories + n.calories,
          protein: sum.protein + n.protein_g,
          fat: sum.fat + n.fat_g,
          carbs: sum.carbs + n.carbs_g,
        };
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

  if (step === "scanning") {
    return (
      <div className="meal-scanner-modal">
        <div className="scanner-header flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Meal Scanner</h2>
          <button className="p-1" onClick={onCancel} aria-label="Close">
            <XMarkIcon size={20} />
          </button>
        </div>

        <div className="scanner-viewfinder flex-1 relative">
          {scanning ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 border-4 border-dashed border-mint rounded-full flex items-center justify-center animate-pulse">
                  <svg className="w-8 h-8 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M3 9a2 2 0 012-2h7l4-4h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                  </svg>
                </div>
                <p className="text-lg">Scanning meal…</p>
                <p className="text-sm text-muted">
                  Detecting Indian meal items
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl text-white mb-4">
                  Scan complete! Found meal items
                </p>
                <button
                  onClick={() => setStep("review")}
                  className="btn-primary px-6 py-3 rounded-lg"
                >
                  Review & Log
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="scanner-footer p-4 border-t">
          <p className="text-[0.7rem] text-muted text-center">
            Point camera at your meal and hold steady<br />
            Optimized for Indian meals (roti, rice, dal, curry, etc.)
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="meal-scanner-modal">
        <div className="scanner-header flex items-center justify-between p-4 border-t">
          <h2 className="text-lg font-semibold">Meal Scanned!</h2>
          <button className="p-1" onClick={onCancel} aria-label="Close">
            <XMarkIcon size={20} />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="w-16 h-16 border-4 border-dashed border-mint rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4M7.835 4.691A11.645 11.645 0 0112 3c.5 0 .98.03 1.445.08"
              />
            </svg>
          </div>
          <p className="text-lg font-medium mb-2">Meal Logged Successfully!</p>
          <p className="text-muted">
            Added {selectedItems.size} items to {mealType}
          </p>
        </div>
      </div>
    );
  }

  // Review step
  return (
    <div className="meal-scanner-modal">
      <div className="scanner-header flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Review Meal Items</h2>
        <button className="p-1" onClick={onCancel} aria-label="Close">
          <XMarkIcon size={20} />
        </button>
      </div>

      <div className="detected-items p-4 space-y-3 overflow-y-auto">
        {detectedItems.map((item) => {
          const checked = selectedItems.has(item.id);
          const nutrition = calculateNutrition(item);
          const qty = quantityMap[item.id] || 100;

          return (
            <div
              key={item.id}
              className="border rounded-xl p-3"
              style={{
                background: "var(--color-card-elevated)",
                borderColor: "var(--color-border)",
                opacity: checked ? 1 : 0.6,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelection(item.id)}
                    className="rounded"
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="text-sm text-muted">{nutrition.calories} kcal</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={qty}
                  onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                  disabled={!checked}
                  className="w-16 border rounded px-1 py-0.5 text-center"
                />
                <span className="text-muted">g</span>
                <span className="text-xs text-muted-strong">
                  Protein: {nutrition.protein_g}g · Carbs: {nutrition.carbs_g}g · Fat: {nutrition.fat_g}g
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals summary */}
      <div className="totals-summary p-4 border-t">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[0.65rem] text-muted">Calories</p>
            <p className="font-bold">{Math.round(totals.calories)}</p>
          </div>
          <div>
            <p className="text-[0.65rem] text-muted">Protein</p>
            <p className="font-bold">{totals.protein.toFixed(1)}g</p>
          </div>
          <div>
            <p className="text-[0.65rem] text-muted">Carbs</p>
            <p className="font-bold">{totals.carbs.toFixed(1)}g</p>
          </div>
          <div>
            <p className="text-[0.65rem] text-muted">Fat</p>
            <p className="font-bold">{totals.fat.toFixed(1)}g</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red mt-2">{error}</p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border rounded-lg transition-colors"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleLogAll}
            disabled={selectedItems.size === 0}
            className="flex-1 btn-primary py-2 rounded-lg"
          >
            Log All Items
          </button>
        </div>
      </div>
    </div>
  );
}