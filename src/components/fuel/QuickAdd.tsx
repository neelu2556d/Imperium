"use client";

import { useState } from "react";
import { addFoodLogs } from "@/lib/supabase/nutrition";
import { MealType } from "@/lib/supabase/nutrition";

interface QuickAddProps {
  onLogged: () => void;
}

export default function QuickAdd({ onLogged }: QuickAddProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [mealType, setMealType] = useState<MealType>("snacks");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const entry = {
      item_name: name.trim(),
      calories: parseInt(calories, 10) || 0,
      protein: parseInt(protein, 10) || 0,
      fat: parseInt(fat, 10) || 0,
      carbs: parseInt(carbs, 10) || 0,
    };
    try {
      await addFoodLogs([entry], "manual", mealType);
      setSaving(false);
      setName("");
      setQuantity(1);
      setCalories("");
      setProtein("");
      setFat("");
      setCarbs("");
      onLogged();
    } catch {
      setError("Couldn't save that item.");
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-sm font-medium mb-2">Quick Add Food</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Item name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Greek yogurt"
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Quantity
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Calories
          </label>
          <input
            type="number"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Protein (g)
          </label>
          <input
            type="number"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Fat (g)
          </label>
          <input
            type="number"
            min={0}
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Carbs (g)
          </label>
          <input
            type="number"
            min={0}
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="mt-1 w-full border rounded p-1"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[0.6rem] uppercase tracking-[0.1em] text-muted">
            Meal
          </label>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="mt-1 w-full border rounded p-1"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snacks">Snacks</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full btn-primary mt-4 py-2"
        >
          {saving ? "Logging…" : "Add to Log"}
        </button>
        {error && <p className="text-[0.75rem] text-red mt-2">{error}</p>}
      </div>
    </div>
  );
}