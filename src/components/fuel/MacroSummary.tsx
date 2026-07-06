"use client";

import FuelRing, {
  PROTEIN_COLOR,
  CARBS_COLOR,
  FAT_COLOR,
} from "@/components/fuel/FuelRing";
import { formatToday } from "@/lib/home/datetime";
import type { NutritionGoals } from "@/lib/supabase/nutrition";

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MacroSummaryProps {
  totals: MacroTotals;
  goals: NutritionGoals;
}

/**
 * Section 1 — the always-visible daily macro summary: today's date, the
 * three-arc macro ring, and a row of three stat pills (protein / carbs / fat)
 * coloured to match their arcs. All values recompute live from `totals`.
 */
export default function MacroSummary({ totals, goals }: MacroSummaryProps) {
  // Computed in render from the local `new Date()`. On the server this uses the
  // server timezone; the client corrects it on hydration, so the element is
  // marked suppressHydrationWarning (matching the /home dashboard).
  const today = formatToday(new Date());

  const pills = [
    {
      label: "Protein",
      logged: totals.protein,
      goal: goals.protein_g,
      color: PROTEIN_COLOR,
    },
    {
      label: "Carbs",
      logged: totals.carbs,
      goal: goals.carbs_g,
      color: CARBS_COLOR,
    },
    { label: "Fat", logged: totals.fat, goal: goals.fat_g, color: FAT_COLOR },
  ];

  return (
    <section
      className="rounded-2xl border p-6"
      data-no-vitality
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <p
        className="mono text-[0.6rem] uppercase tracking-[0.2em] text-muted"
        suppressHydrationWarning
      >
        {today}
      </p>

      <div className="mt-5 flex flex-col items-center">
        <FuelRing
          calories={totals.calories}
          goalCalories={goals.calories}
          protein={{
            logged: totals.protein,
            goal: goals.protein_g,
            color: PROTEIN_COLOR,
          }}
          carbs={{
            logged: totals.carbs,
            goal: goals.carbs_g,
            color: CARBS_COLOR,
          }}
          fat={{ logged: totals.fat, goal: goals.fat_g, color: FAT_COLOR }}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {pills.map((p) => (
          <div
            key={p.label}
            className="flex flex-col items-center rounded-xl border px-2 py-3"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-card-elevated)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="text-[0.7rem] font-medium text-muted-strong">
                {p.label}
              </span>
            </span>
            <span
              className="mono mt-1.5 text-sm tabular-nums"
              style={{ color: p.color }}
            >
              {Math.round(p.logged)}
              <span className="text-muted">g</span>
            </span>
            <span className="mono text-[0.65rem] text-muted">
              / {Math.round(p.goal)}g
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
