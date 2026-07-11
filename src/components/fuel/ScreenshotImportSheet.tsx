"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/vitals/BottomSheet";
import {
  addFoodLogs,
  type FoodEntryInput,
  type MealType,
} from "@/lib/supabase/nutrition";

interface ScreenshotImportSheetProps {
  file: File;
  onClose: () => void;
  onLogged: () => void;
  /** "Try logging manually instead" fallback from the error state. */
  onFallbackManual: () => void;
  /** Which meal section the imported items are logged into. */
  mealType: MealType;
  /** Human label for the meal, shown in the sheet title. */
  mealLabel: string;
}

/** A parsed item held in editable form (string fields for the inputs). */
interface DraftItem {
  item_name: string;
  calories: string;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
}

type Phase = "loading" | "confirm" | "error";

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Section 3B — the screenshot import flow. Reads the chosen image, POSTs it to
 * /api/parse-nutrition-screenshot (Groq vision), then shows the extracted items
 * in editable Imperium-style cards before the user confirms. "Log all →"
 * inserts every item with source 'screenshot_import'. Parse failures drop to an
 * error card offering the manual-logging fallback.
 */
export default function ScreenshotImportSheet({
  file,
  onClose,
  onLogged,
  onFallbackManual,
  mealType,
  mealLabel,
}: ScreenshotImportSheetProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const ranFor = useRef<File | null>(null);

  useEffect(() => {
    // Guard against double-invocation (React strict mode) for the same file.
    if (ranFor.current === file) return;
    ranFor.current = file;

    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await readAsDataUrl(file);
        const res = await fetch("/api/parse-nutrition-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const payload = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !payload?.items?.length) {
          setError(
            payload?.error ?? "Couldn't read that screenshot."
          );
          setPhase("error");
          return;
        }

        setItems(
          payload.items.map(
            (it: {
              item_name?: string;
              calories?: number;
              protein_g?: number;
              fat_g?: number;
              carbs_g?: number;
            }) => ({
              item_name: it.item_name ?? "",
              calories: String(it.calories ?? 0),
              protein_g: String(it.protein_g ?? 0),
              fat_g: String(it.fat_g ?? 0),
              carbs_g: String(it.carbs_g ?? 0),
            })
          )
        );
        setPhase("confirm");
      } catch {
        if (!cancelled) {
          setError("Couldn't read that screenshot.");
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const update = (i: number, key: keyof DraftItem, value: string) =>
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it))
    );

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const logAll = async () => {
    if (saving || items.length === 0) return;
    setSaving(true);
    const entries: FoodEntryInput[] = items.map((it) => ({
      item_name: it.item_name.trim() || "Untitled item",
      calories: toNum(it.calories),
      protein: toNum(it.protein_g),
      fat: toNum(it.fat_g),
      carbs: toNum(it.carbs_g),
    }));
    try {
      await addFoodLogs(entries, "screenshot_import", mealType);
      onLogged();
      onClose();
    } catch {
      setError("Couldn't save those items. Try again.");
      setPhase("error");
      setSaving(false);
    }
  };

  return (
    <BottomSheet title={`Import · ${mealLabel}`} onClose={onClose}>
      {phase === "loading" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <span
            className="h-7 w-7 animate-spin rounded-full border-2"
            style={{
              borderColor: "var(--color-border-strong)",
              borderTopColor: "var(--color-mint)",
            }}
            aria-hidden
          />
          <p className="text-sm text-muted-strong">Reading your screenshot…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4 flex flex-col gap-4">
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: "var(--color-red)",
              background: "rgba(239, 68, 68, 0.06)",
            }}
          >
            <p className="text-sm font-medium">Couldn&apos;t read that one.</p>
            <p className="mt-1 text-[0.8rem] text-muted">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onFallbackManual();
            }}
            className="btn-primary w-full"
          >
            Try logging manually instead
          </button>
        </div>
      )}

      {phase === "confirm" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[0.8rem] text-muted">
            {items.length} item{items.length === 1 ? "" : "s"} found — tweak
            anything before logging.
          </p>

          <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto pr-1">
            {items.map((it, i) => (
              <div
                key={i}
                className="rounded-xl border p-3"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-card-elevated)",
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.item_name}
                    placeholder="Item name"
                    onChange={(e) => update(i, "item_name", e.target.value)}
                    className="flex-1 text-sm font-medium"
                    data-no-vitality
                    style={{ ...inputStyle, borderColor: "transparent", background: "transparent", padding: "0.25rem 0" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    data-no-vitality
                    aria-label="Remove item"
                    className="mono shrink-0 border-0 bg-transparent p-1 text-[0.7rem] text-muted"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(
                    [
                      ["calories", "kcal"],
                      ["protein_g", "P"],
                      ["fat_g", "F"],
                      ["carbs_g", "C"],
                    ] as [keyof DraftItem, string][]
                  ).map(([key, unit]) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="mono text-center text-[0.55rem] uppercase tracking-[0.08em] text-muted">
                        {unit}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={it[key]}
                        onChange={(e) => update(i, key, e.target.value)}
                        className="mono text-center text-[0.8rem] tabular-nums"
                        data-no-vitality
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onFallbackManual();
              }}
              className="w-full"
              data-no-vitality
              style={{
                border: "1px solid var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-fg)",
              }}
            >
              Log manually instead
            </button>
          ) : (
            <button
              type="button"
              onClick={logAll}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? "Logging…" : `Log all →`}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.4rem 0.4rem",
  color: "var(--color-fg)",
};
