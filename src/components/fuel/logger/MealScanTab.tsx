"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scanMeal } from "@/lib/fuel/api";
import { pushToast } from "@/lib/toast";
import { insertFoodLogs, type MealType, type NewFoodLog } from "@/lib/supabase/nutrition";
import { scaleMacros, type FoodSearchResult } from "@/lib/fuel/food";

interface MealScanTabProps {
  meal: MealType;
  date: string;
  mealLabel: string;
  onReviewOne: (food: FoodSearchResult, amount: number) => void;
  onManual: () => void;
}

interface ScanItem {
  food: FoodSearchResult;
  grams: number;
  checked: boolean;
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

/**
 * Meal Scan method — upload/take a photo, send it to /api/food-meal-scan, then
 * confirm the identified items (toggle, rename, adjust grams) before logging
 * them all at once, or review each in the serving selector.
 */
export default function MealScanTab({ meal, date, mealLabel, onReviewOne, onManual }: MealScanTabProps) {
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "loading" | "confirm" | "error">("pick");
  const [items, setItems] = useState<ScanItem[]>([]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const url = await readAsDataUrl(file);
    setImage(url);
    setPhase("pick");
  };

  const scan = async () => {
    if (!image) return;
    setPhase("loading");
    const res = await scanMeal(image);
    if ("items" in res && res.items.length > 0) {
      setItems(res.items.map((food) => ({ food, grams: food.estimated_grams ?? 100, checked: true })));
      setPhase("confirm");
    } else {
      setPhase("error");
    }
  };

  const logSelected = async () => {
    const chosen = items.filter((it) => it.checked);
    if (chosen.length === 0) return;
    const rows: NewFoodLog[] = chosen.map((it) => {
      const m = scaleMacros(it.food.per100g, it.grams);
      return {
        logged_date: date,
        meal_type: meal,
        food_source: it.food.source,
        food_ref_id: it.food.id || null,
        food_name: it.food.name,
        brand: null,
        serving_amount: it.grams,
        serving_unit: "g",
        serving_g: it.grams,
        calories: m.calories,
        protein_g: m.protein_g,
        fat_g: m.fat_g,
        carbs_g: m.carbs_g,
        fiber_g: m.fiber_g,
      };
    });
    try {
      await insertFoodLogs(rows);
      pushToast(`${rows.length} item${rows.length > 1 ? "s" : ""} added to ${mealLabel}`);
      router.push("/fuel");
    } catch {
      pushToast("Couldn't log those items.");
    }
  };

  const reviewOne = () => {
    const first = items.find((it) => it.checked);
    if (first) onReviewOne(first.food, first.grams);
  };

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="vt-gem-svg h-10 w-10 rounded-full" style={{ background: "var(--accent)", filter: "drop-shadow(0 0 16px var(--accent-glow))" }} />
        <p className="text-[0.85rem] text-muted-strong">Identifying food items…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border p-5 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
        <p className="text-[0.85rem] text-muted-strong">
          Couldn&apos;t identify food items. Try again with better lighting or a closer photo.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={() => setPhase("pick")}>Try again</button>
          <button type="button" onClick={onManual} className="btn-primary">Add manually instead</button>
        </div>
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div>
        <h2 className="serif-italic text-xl" data-no-vitality>
          Found {items.length} item{items.length > 1 ? "s" : ""} — {mealLabel}
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {items.map((it, i) => {
            const cal = scaleMacros(it.food.per100g, it.grams).calories;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
              >
                <input
                  type="checkbox"
                  checked={it.checked}
                  onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                />
                <input
                  type="text"
                  value={it.food.name}
                  onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, food: { ...x.food, name: e.target.value } } : x)))}
                  className="min-w-0 flex-1 text-[0.88rem]"
                  data-no-vitality
                  style={{ background: "transparent", border: "none", color: "var(--color-fg)", padding: 0 }}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={it.grams}
                  onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value) || 0 } : x)))}
                  className="mono tabular-nums w-16 text-right"
                  data-no-vitality
                  style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.3rem", color: "var(--color-fg)" }}
                />
                <span className="mono w-16 shrink-0 text-right text-[0.72rem] text-muted">{Math.round(cal)} kcal</span>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={logSelected} className="btn-primary mt-5 w-full">Log selected →</button>
        <button type="button" onClick={reviewOne} className="link mx-auto mt-3 block text-[0.8rem]" data-no-vitality style={{ background: "transparent", border: "none" }}>
          Review one by one
        </button>
      </div>
    );
  }

  // pick phase
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-10"
        style={{ borderColor: "var(--accent)", background: "var(--color-card)" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- base64 preview of a just-picked photo; next/image can't optimize a data URL
          <img src={image} alt="Meal" className="max-h-[280px] rounded-lg object-contain" />
        ) : (
          <>
            <span className="text-3xl" aria-hidden>📷</span>
            <p className="text-[0.9rem] font-medium">Take a photo of your meal</p>
            <p className="text-[0.75rem] text-muted">or tap to choose from gallery</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => cameraInput.current?.click()}>Camera</button>
        <button type="button" onClick={() => galleryInput.current?.click()}>Gallery</button>
      </div>

      {image && (
        <button type="button" onClick={scan} className="btn-primary w-full">Scan meal →</button>
      )}

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
    </div>
  );
}
