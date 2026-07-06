"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MacroDonut from "@/components/onboarding/macros/MacroDonut";
import {
  DEFAULT_NUTRITION_GOALS,
  fetchNutritionGoals,
  saveNutritionGoals,
  type NutritionGoals,
} from "@/lib/supabase/nutrition";

interface FieldDef {
  key: keyof NutritionGoals;
  label: string;
  unit: string;
}

const FIELDS: FieldDef[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
];

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * /settings/nutrition — edit the macro targets that drive the Fuel ring. Loads
 * the saved goals (falling back to the defaults), previews the calorie split
 * live via MacroDonut, and upserts on save before returning to /fuel.
 */
export default function NutritionSettingsScreen() {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof NutritionGoals, string>>({
    calories: String(DEFAULT_NUTRITION_GOALS.calories),
    protein_g: String(DEFAULT_NUTRITION_GOALS.protein_g),
    fat_g: String(DEFAULT_NUTRITION_GOALS.fat_g),
    carbs_g: String(DEFAULT_NUTRITION_GOALS.carbs_g),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNutritionGoals()
      .then((g) => {
        if (cancelled || !g) return;
        setValues({
          calories: String(g.calories),
          protein_g: String(g.protein_g),
          fat_g: String(g.fat_g),
          carbs_g: String(g.carbs_g),
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const goals: NutritionGoals = {
    calories: toNum(values.calories),
    protein_g: toNum(values.protein_g),
    fat_g: toNum(values.fat_g),
    carbs_g: toNum(values.carbs_g),
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveNutritionGoals(goals);
      router.push("/fuel");
    } catch {
      setError("Couldn't save your targets. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="mb-6">
        <Link
          href="/fuel"
          className="mono text-[0.62rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg"
        >
          ← Fuel
        </Link>
        <h1 className="serif-italic mt-2 text-4xl leading-tight" data-no-vitality>
          Nutrition goals
        </h1>
        <p className="mt-1 text-sm text-muted">
          Set the daily targets your Fuel ring fills toward.
        </p>
      </header>

      <div
        className="flex flex-col gap-6 rounded-2xl border p-6"
        data-no-vitality
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-card)",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 200ms",
        }}
      >
        <div className="flex justify-center">
          <MacroDonut
            calories={goals.calories}
            proteinG={goals.protein_g}
            carbsG={goals.carbs_g}
            fatG={goals.fat_g}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                {f.label}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="mono w-full tabular-nums"
                  data-no-vitality
                  style={inputStyle}
                />
                <span className="mono text-xs text-muted">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <p className="text-[0.78rem]" style={{ color: "var(--color-red)" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving ? "Saving…" : "Save targets"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.6875rem 0.75rem",
  color: "var(--color-fg)",
};
