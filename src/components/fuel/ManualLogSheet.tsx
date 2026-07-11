"use client";

import { useState } from "react";
import BottomSheet from "@/components/vitals/BottomSheet";
import {
  addFoodLogs,
  type FoodEntryInput,
  type MealType,
} from "@/lib/supabase/nutrition";

interface ManualLogSheetProps {
  onClose: () => void;
  onLogged: () => void;
  /** Which meal section this entry is logged into. */
  mealType: MealType;
  /** Human label for the meal, shown in the sheet title. */
  mealLabel: string;
}

interface NumField {
  key: "calories" | "protein" | "fat" | "carbs";
  label: string;
}

// Order per spec: Calories, Protein, Fat, Carbs.
const NUM_FIELDS: NumField[] = [
  { key: "calories", label: "Calories" },
  { key: "protein", label: "Protein (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "carbs", label: "Carbs (g)" },
];

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Section 3A — the manual "Log it" form in a bottom sheet: an item name plus
 * calories / protein / fat / carbs, inserted into food_logs with source
 * 'manual' for today. On success it tells the parent to refresh and closes.
 */
export default function ManualLogSheet({
  onClose,
  onLogged,
  mealType,
  mealLabel,
}: ManualLogSheetProps) {
  const [name, setName] = useState("");
  const [vals, setVals] = useState<Record<NumField["key"], string>>({
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && !saving;

  const log = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const entry: FoodEntryInput = {
      item_name: name.trim(),
      calories: toNum(vals.calories),
      protein: toNum(vals.protein),
      fat: toNum(vals.fat),
      carbs: toNum(vals.carbs),
    };
    try {
      await addFoodLogs([entry], "manual", mealType);
      onLogged();
      onClose();
    } catch {
      setError("Couldn't save that. Try again.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet title={`Log · ${mealLabel}`} onClose={onClose}>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
            Item name
          </span>
          <input
            type="text"
            value={name}
            autoFocus
            placeholder="e.g. Greek yogurt bowl"
            onChange={(e) => setName(e.target.value)}
            data-no-vitality
            style={inputStyle}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {NUM_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                {f.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={vals[f.key]}
                placeholder="0"
                onChange={(e) =>
                  setVals((v) => ({ ...v, [f.key]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && log()}
                className="mono tabular-nums"
                data-no-vitality
                style={inputStyle}
              />
            </label>
          ))}
        </div>

        {error && (
          <p className="text-[0.75rem]" style={{ color: "var(--color-red)" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={log}
          disabled={!canSave}
          className="btn-primary mt-2 w-full"
        >
          {saving ? "Logging…" : "Log it"}
        </button>
      </div>
    </BottomSheet>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.6875rem 0.75rem",
  color: "var(--color-fg)",
};
