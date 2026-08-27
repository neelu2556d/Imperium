"use client";

import CountUp from "@/components/motion/CountUp";
import { PROTEIN_COLOR, CARBS_COLOR, FAT_COLOR } from "@/lib/fuel/food";

interface MacrosCardProps {
  protein: number;
  carbs: number;
  fat: number;
  goalProtein: number;
  goalCarbs: number;
  goalFat: number;
}

/** Today view — three macro columns (protein / carbs / fat) with goal bars. */
export default function MacrosCard({
  protein,
  carbs,
  fat,
  goalProtein,
  goalCarbs,
  goalFat,
}: MacrosCardProps) {
  const cols = [
    { label: "Protein", logged: protein, goal: goalProtein, color: PROTEIN_COLOR },
    { label: "Carbs", logged: carbs, goal: goalCarbs, color: CARBS_COLOR },
    { label: "Fat", logged: fat, goal: goalFat, color: FAT_COLOR },
  ];

  return (
    <section
      className="grid grid-cols-3 gap-3 rounded-2xl border p-4"
      data-no-vitality
      style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
    >
      {cols.map((c) => {
        const pct = c.goal > 0 ? Math.min(100, (c.logged / c.goal) * 100) : 0;
        return (
          <div key={c.label} className="flex flex-col items-center gap-1.5">
            <span className="text-[0.7rem] font-medium text-muted-strong">{c.label}</span>
            <span className="mono tabular-nums text-base font-semibold" style={{ color: c.color }}>
              <CountUp value={Math.round(c.logged)} restartKey={c.logged} />
              <span className="text-muted">g</span>
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: c.color, transition: "width 400ms var(--ease-premium)" }}
              />
            </div>
            <span className="mono text-[0.62rem] text-muted">/ {Math.round(c.goal)}g goal</span>
          </div>
        );
      })}
    </section>
  );
}
