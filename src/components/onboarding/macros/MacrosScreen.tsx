"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import { markStepComplete } from "@/lib/supabase/onboarding";
import { fetchBodyStats } from "@/lib/supabase/profile";
import {
  DEFAULT_NUTRITION_GOALS,
  fetchNutritionGoals,
  saveNutritionGoals,
} from "@/lib/supabase/nutrition";
import MacroDonut from "@/components/onboarding/macros/MacroDonut";

interface FieldDef {
  key: "calories" | "protein" | "fat" | "carbs";
  label: string;
  unit: string;
}

const FIELDS: FieldDef[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
];

const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export default function MacrosScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();

  const [values, setValues] = useState<Record<FieldDef["key"], string>>({
    calories: String(DEFAULT_NUTRITION_GOALS.calories),
    protein: String(DEFAULT_NUTRITION_GOALS.protein_g),
    fat: String(DEFAULT_NUTRITION_GOALS.fat_g),
    carbs: String(DEFAULT_NUTRITION_GOALS.carbs_g),
  });
  const [hasStats, setHasStats] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [goals, stats] = await Promise.allSettled([
        fetchNutritionGoals(),
        fetchBodyStats(),
      ]);
      if (cancelled) return;

      if (goals.status === "fulfilled" && goals.value) {
        const g = goals.value;
        setValues({
          calories: String(g.calories),
          protein: String(g.protein_g),
          fat: String(g.fat_g),
          carbs: String(g.carbs_g),
        });
      }
      if (stats.status === "fulfilled") {
        setHasStats(stats.value.heightCm != null && stats.value.weightKg != null);
      } else {
        setHasStats(true); // don't nudge if we couldn't check
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Never show setup screens once onboarding is finished.
  useEffect(() => {
    if (onboarding.status === "ready" && onboarding.isComplete) {
      router.replace("/train");
    }
  }, [onboarding, router]);

  const setField = (key: FieldDef["key"], value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const valid = FIELDS.every((f) => {
    const raw = values[f.key].trim();
    return raw !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0;
  });

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveNutritionGoals({
        calories: toNumber(values.calories),
        protein_g: toNumber(values.protein),
        fat_g: toNumber(values.fat),
        carbs_g: toNumber(values.carbs),
      });
      await markStepComplete("macros");
      router.push("/onboarding/setup");
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link
        href="/onboarding/setup"
        aria-label="Go back"
        data-no-vitality
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <p
        className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        Set your macros · Step 3 of 4
      </p>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={75}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          data-no-vitality
          className="h-full rounded-full"
          style={{ width: "75%", background: "var(--color-mint)" }}
        />
      </div>

      <h1 className="mt-8 text-3xl">Let&rsquo;s set your fuel targets.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        These are your daily goals. I&rsquo;ll track everything against them. You can
        change these anytime.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label
              htmlFor={`macro-${f.key}`}
              className="mb-2 block text-sm text-muted-strong"
            >
              {f.label}
            </label>
            <div className="relative">
              <input
                id={`macro-${f.key}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={values[f.key]}
                className="w-full pr-12"
                onChange={(e) => setField(f.key, e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                {f.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-9">
        <MacroDonut
          calories={toNumber(values.calories)}
          proteinG={toNumber(values.protein)}
          carbsG={toNumber(values.carbs)}
          fatG={toNumber(values.fat)}
        />
      </div>

      {hasStats === false && (
        <Link
          href="/onboarding/about"
          className="mt-6 block rounded-lg border p-3 text-center text-xs leading-snug text-muted transition-colors hover:text-white"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          Add your stats in{" "}
          <span style={{ color: "var(--color-mint)" }}>&ldquo;Tell me about you&rdquo;</span>{" "}
          and I can suggest targets for you.
        </Link>
      )}

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-8 w-full"
        disabled={!valid || saving}
        onClick={handleSave}
      >
        {saving ? "Saving…" : "save targets →"}
      </button>
    </div>
  );
}
