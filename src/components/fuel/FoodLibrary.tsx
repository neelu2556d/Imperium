"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  fetchNutritionByName,
  type FoodEntry,
} from "@/lib/supabase/foodLibrary";

interface FoodLibraryProps {
  onSelect: (food: FoodEntry) => void;
  initialSearch?: string;
  initialMeal?: string;
}

export default function FoodLibrary({
  onSelect,
  initialSearch = "",
  initialMeal = "snacks",
}: FoodLibraryProps) {
  const [search, setSearch] = useState(initialSearch);
  const [activeMeal, setActiveMeal] = useState(initialMeal);
  const [results, setResults] = useState<FoodEntry[]>([]);
  const [selected, setSelected] = useState<FoodEntry | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    return results.filter((f) =>
      f.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, results]);

  const handleSelect = (food: FoodEntry) => {
    setSelected(food);
    // Log the selected food to the current meal and navigate back
    setTimeout(() => onSelect(food), 100);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (value.trim()) {
      fetchNutritionByName(value).then((data) => setResults(data));
    } else {
      setResults([]);
    }
  };

  return (
    <div className="food-library-overlay">
      <div className="food-library-container">
        <div className="food-library-header">
          <h2 className="text-xl font-bold mb-2">Food Library</h2>
          <p className="text-muted text-sm">Search 22M+ items database</p>
          <button
            className="close-btn"
            onClick={() => router.back()}
            aria-label="Close food library"
          >
            ← Back
          </button>
        </div>

        <div className="food-library-search">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
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
            <input
              type="text"
              placeholder="Search foods..."
              value={search}
              onChange={handleSearch}
              className="input w-full pl-10 pr-4 py-2.5 border rounded text-lg"
              autoFocus
            />
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="food-library-results">
            {filtered.map((food) => (
              <div
                key={food.id}
                className="food-result-item"
                onClick={() => handleSelect(food)}
                style={{
                  cursor: "pointer",
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span className="food-name font-medium text-lg">
                  {food.name}
                </span>
                <div className="food-details flex items-center gap-4 text-sm text-muted-strong">
                  <span>{food.calories} kcal</span>
                  <span>{food.protein_g}g protein</span>
                  <span>{food.carbs_g}g carbs</span>
                  <span>{food.fat_g}g fat</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!filtered.length && search.trim() && (
          <div className="no-results py-8 text-center">
            <p className="text-muted">No foods found</p>
            <p className="text-sm mt-2">
              Try a different name or browse the full database
            </p>
          </div>
        )}

        {selected && (
          <div className="selected-food-summary">
            <h3 className="font-medium mb-2">Selected</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted">Item</span>
                <p className="font-bold">{selected.name}</p>
              </div>
              <div>
                <span className="text-muted">Calories</span>
                <p className="font-bold">{selected.calories} kcal</p>
              </div>
              <div>
                <span className="text-muted">Protein</span>
                <p className="font-bold">{selected.protein_g}g</p>
              </div>
              <div>
                <span className="text-muted">Carbs</span>
                <p className="font-bold">{selected.carbs_g}g</p>
              </div>
              <div>
                <span className="text-muted">Fat</span>
                <p className="font-bold">{selected.fat_g}g</p>
              </div>
            </div>
            <button
              className="btn-primary w-full mt-3 py-2"
              onClick={() => {
                handleSelect(selected);
                router.push("/fuel");
              }}
            >
              Add to {activeMeal}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}