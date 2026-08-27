"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchFoodLogsRange,
  localISODate,
  MEAL_TYPES,
  type FoodLog,
  type MealType,
  type NutritionGoals,
} from "@/lib/supabase/nutrition";
import { PROTEIN_COLOR, CARBS_COLOR, FAT_COLOR } from "@/lib/fuel/food";

type Period = "day" | "week" | "month";

interface ProgressViewProps {
  selectedDate: string;
  goals: NutritionGoals;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function mondayOf(d: Date): Date {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  c.setHours(0, 0, 0, 0);
  return c;
}

/** [start, end] ISO dates + the list of day ISO strings the period spans. */
function periodRange(period: Period, selected: string): { start: string; end: string; days: string[] } {
  const base = parseISO(selected);
  if (period === "day") return { start: selected, end: selected, days: [selected] };
  if (period === "week") {
    const start = mondayOf(base);
    const days = Array.from({ length: 7 }, (_, i) => localISODate(addDays(start, i)));
    return { start: days[0], end: days[6], days };
  }
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const n = last.getDate();
  const days = Array.from({ length: n }, (_, i) => localISODate(new Date(base.getFullYear(), base.getMonth(), i + 1)));
  return { start: days[0], end: days[n - 1], days };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/**
 * Progress view — a period toggle (Day / Week / Month) over a calories chart
 * (per-meal bars for a day, a per-day line for week/month), a P/C/F macro donut
 * with the period's total calories at its centre, and three macro bars showing
 * the daily average vs goal plus the period total.
 */
export default function ProgressView({ selectedDate, goals }: ProgressViewProps) {
  const [period, setPeriod] = useState<Period>("day");
  const [logs, setLogs] = useState<FoodLog[]>([]);

  const { start, end, days } = useMemo(() => periodRange(period, selectedDate), [period, selectedDate]);

  useEffect(() => {
    let cancelled = false;
    fetchFoodLogsRange(start, end).then((rows) => {
      if (!cancelled) setLogs(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (a, l) => ({
          calories: a.calories + l.calories,
          protein: a.protein + l.protein_g,
          carbs: a.carbs + l.carbs_g,
          fat: a.fat + l.fat_g,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [logs]
  );

  // Chart series
  const dayMealBars = useMemo(() => {
    const byMeal: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
    for (const l of logs) byMeal[l.meal_type] += l.calories;
    return MEAL_TYPES.map((m) => ({ label: m.label.slice(0, 1), value: byMeal[m.type] }));
  }, [logs]);

  const dayLine = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const l of logs) byDate.set(l.logged_date, (byDate.get(l.logged_date) ?? 0) + l.calories);
    return days.map((d) => byDate.get(d) ?? 0);
  }, [logs, days]);

  const nDays = days.length;
  const dailyGoal = goals.calories;

  return (
    <div className="flex flex-col gap-4">
      {/* period pills */}
      <div className="flex gap-2">
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              data-no-vitality
              className="flex-1 rounded-full px-3 py-2 text-[0.8rem] font-medium"
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                background: active ? "var(--accent)" : "var(--color-card-elevated)",
                color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* calories chart */}
      <section
        className="rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Calories</p>
        <div className="mt-4">
          {period === "day" ? (
            <BarChart bars={dayMealBars} />
          ) : (
            <LineChart values={dayLine} />
          )}
        </div>
      </section>

      {/* macro donut */}
      <section
        className="flex items-center gap-5 rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <MacroDonut protein={totals.protein} carbs={totals.carbs} fat={totals.fat} calories={totals.calories} />
        <div className="flex flex-col gap-2 text-[0.8rem]">
          <Legend color={PROTEIN_COLOR} label="Protein" grams={totals.protein} />
          <Legend color={CARBS_COLOR} label="Carbs" grams={totals.carbs} />
          <Legend color={FAT_COLOR} label="Fat" grams={totals.fat} />
        </div>
      </section>

      {/* macro bars */}
      <section
        className="flex flex-col gap-4 rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <MacroBar label="Protein" color={PROTEIN_COLOR} total={totals.protein} avg={totals.protein / nDays} goal={goals.protein_g} />
        <MacroBar label="Carbs" color={CARBS_COLOR} total={totals.carbs} avg={totals.carbs / nDays} goal={goals.carbs_g} />
        <MacroBar label="Fat" color={FAT_COLOR} total={totals.fat} avg={totals.fat / nDays} goal={goals.fat_g} />
        <p className="mono text-[0.62rem] text-muted">
          Daily calorie goal {Math.round(dailyGoal).toLocaleString()} · {nDays} day{nDays > 1 ? "s" : ""}
        </p>
      </section>
    </div>
  );
}

/* --------------------------------- charts --------------------------------- */

function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex h-40 items-end justify-around gap-3">
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="mono text-[0.6rem] tabular-nums text-muted">{Math.round(b.value)}</span>
          <div className="flex w-full flex-1 items-end" style={{ height: "100%" }}>
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${(b.value / max) * 100}%`,
                minHeight: 2,
                background: "var(--accent)",
                transition: "height 500ms var(--ease-premium)",
              }}
            />
          </div>
          <span className="text-[0.62rem] text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ values }: { values: number[] }) {
  const W = 320;
  const H = 140;
  const pad = 8;
  const max = Math.max(1, ...values);
  const n = values.length;
  const points = values.map((v, i) => {
    const x = pad + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad * 2));
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
      <path
        key={d}
        d={d}
        pathLength={1}
        className="spark-line"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px var(--accent-glow))" }}
      />
    </svg>
  );
}

function MacroDonut({ protein, carbs, fat, calories }: { protein: number; carbs: number; fat: number; calories: number }) {
  const total = protein + carbs + fat || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  const segs = [
    { v: protein, color: PROTEIN_COLOR },
    { v: carbs, color: CARBS_COLOR },
    { v: fat, color: FAT_COLOR },
  ];
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: 108, height: 108 }}>
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
        <circle cx={54} cy={54} r={R} fill="none" stroke="var(--color-border)" strokeWidth={12} />
        {segs.map((s, i) => {
          const len = (s.v / total) * C;
          const dash = `${len} ${C - len}`;
          const el = (
            <circle
              key={i}
              cx={54}
              cy={54}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={12}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray 500ms var(--ease-premium)" }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono text-sm tabular-nums text-white">{Math.round(calories)}</span>
        <span className="text-[0.55rem] text-muted">kcal</span>
      </div>
    </div>
  );
}

function Legend({ color, label, grams }: { color: string; label: string; grams: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      <span className="text-muted-strong">{label}</span>
      <span className="mono tabular-nums text-muted">{Math.round(grams)}g</span>
    </span>
  );
}

function MacroBar({ label, color, total, avg, goal }: { label: string; color: string; total: number; avg: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (avg / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[0.8rem] text-muted-strong">{label}</span>
        <span className="mono text-[0.72rem] tabular-nums text-muted">
          {Math.round(avg)}g<span className="text-muted">/day</span> · {Math.round(total)}g total
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 500ms var(--ease-premium)" }} />
      </div>
    </div>
  );
}
