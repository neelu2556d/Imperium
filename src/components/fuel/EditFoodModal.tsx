"use client";

import { useState } from "react";
import { pushToast } from "@/lib/toast";
import { editFood, resetFood } from "@/lib/fuel/api";
import { safeNum, type Per100g } from "@/lib/fuel/food";

interface EditFoodModalProps {
  foodId: string;
  source: string;
  per100g: Per100g;
  onClose: () => void;
  /** Called with the new per-100g block after a save or reset. */
  onSaved: (next: Per100g) => void;
}

interface Field {
  key: keyof Per100g;
  label: string;
}

const FIELDS: Field[] = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein_g", label: "Protein (g)" },
  { key: "fat_g", label: "Fat (g)" },
  { key: "carbs_g", label: "Carbs (g)" },
  { key: "fiber_g", label: "Fiber (g)" },
];

/** Sources whose edits persist to a DB row (others edit in-memory only). */
const PERSISTS = new Set(["indian", "custom"]);

/**
 * Step 9 — "Edit nutrition values" modal, opened from the serving selector's
 * pencil. Edits are per-100g. For indian/custom foods the values persist via
 * /api/food-edit (and "Reset to original" reverts them); for external sources
 * (USDA/OFF/barcode/scan) the edit updates the current serving selector only.
 */
export default function EditFoodModal({
  foodId,
  source,
  per100g,
  onClose,
  onSaved,
}: EditFoodModalProps) {
  const [vals, setVals] = useState<Record<keyof Per100g, string>>({
    calories: String(round(per100g.calories)),
    protein_g: String(round(per100g.protein_g)),
    fat_g: String(round(per100g.fat_g)),
    carbs_g: String(round(per100g.carbs_g)),
    fiber_g: String(round(per100g.fiber_g)),
  });
  const [busy, setBusy] = useState(false);

  const next: Per100g = {
    calories: safeNum(vals.calories),
    protein_g: safeNum(vals.protein_g),
    fat_g: safeNum(vals.fat_g),
    carbs_g: safeNum(vals.carbs_g),
    fiber_g: safeNum(vals.fiber_g),
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (PERSISTS.has(source)) {
        const saved = await editFood(foodId, source, next);
        if (!saved) {
          pushToast("Couldn't save those values.");
          setBusy(false);
          return;
        }
        onSaved(saved);
      } else {
        onSaved(next); // in-memory only
      }
      pushToast("Values updated");
      onClose();
    } catch {
      pushToast("Couldn't save those values.");
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    const restored = await resetFood(foodId, source);
    setBusy(false);
    if (restored === null) {
      pushToast("Couldn't reset.");
      return;
    }
    // "ok" means the base DB columns apply again; re-fetch isn't available here,
    // so we simply toast — the caller keeps its current values until re-search.
    if (restored !== "ok") {
      onSaved(restored);
      setVals({
        calories: String(round(restored.calories)),
        protein_g: String(round(restored.protein_g)),
        fat_g: String(round(restored.fat_g)),
        carbs_g: String(round(restored.carbs_g)),
        fiber_g: String(round(restored.fiber_g)),
      });
    }
    pushToast("Reset to original");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div
        className="absolute inset-0 vt-sheet-backdrop"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 vt-rise-in"
        role="dialog"
        aria-label="Edit nutrition values"
        style={{ borderColor: "var(--color-border-strong)", background: "var(--color-bg-elevated)" }}
      >
        <h3 className="serif-italic text-xl" data-no-vitality>
          Edit nutrition values
        </h3>
        <p className="mt-1 text-[0.78rem] text-muted">Per 100g · saved for future searches</p>

        <div className="mt-4 flex flex-col gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3">
              <span className="text-[0.82rem] text-muted-strong">{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={vals[f.key]}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mono tabular-nums w-28 text-right"
                data-no-vitality
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.5rem 0.6rem",
                  color: "var(--color-fg)",
                }}
              />
            </label>
          ))}
        </div>

        <button type="button" onClick={save} disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? "Saving…" : "Save"}
        </button>

        {PERSISTS.has(source) && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            data-no-vitality
            className="mx-auto mt-3 block text-[0.78rem] text-muted underline"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            Reset to original
          </button>
        )}
      </div>
    </div>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
