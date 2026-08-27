"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchExerciseProgress,
  fetchLoggedExerciseNames,
  fetchMeasurements,
  fetchPersonalRecords,
  type BodyMeasurement,
  type PersonalRecord,
  type ProgressPoint,
} from "@/lib/supabase/workouts";
import { getTrainSettings, kgToDisplay } from "@/lib/train/settings";

/** Progress sub-tab: personal records, a per-exercise 1RM line, measurements. */
export default function ProgressView() {
  const unit = getTrainSettings().unit;
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [points, setPoints] = useState<ProgressPoint[]>([]);
  const [latest, setLatest] = useState<BodyMeasurement | null>(null);

  useEffect(() => {
    fetchPersonalRecords().then(setPrs);
    fetchLoggedExerciseNames().then((n) => {
      setNames(n);
      setSelected((cur) => cur || n[0] || "");
    });
    fetchMeasurements().then((m) => setLatest(m[0] ?? null));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetchExerciseProgress(selected).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const line = useMemo(() => points.map((p) => kgToDisplay(p.best1rm, unit)), [points, unit]);

  return (
    <div className="flex flex-col gap-4">
      {/* personal records */}
      <section
        className="rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Personal records</p>
        {prs.length === 0 ? (
          <p className="mt-3 text-[0.82rem] text-muted">Complete a set to set your first PR.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {prs.map((pr) => (
              <div key={pr.id} className="flex items-baseline justify-between">
                <span className="min-w-0 flex-1 truncate text-[0.88rem] font-medium">{pr.exercise_name}</span>
                <span className="mono ml-3 shrink-0 text-[0.78rem] tabular-nums text-muted-strong">
                  {Math.round(kgToDisplay(pr.best_weight_kg, unit))}
                  {unit} × {pr.best_reps}
                  <span className="text-muted"> · 1RM {Math.round(kgToDisplay(pr.estimated_1rm, unit))}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* per-exercise progress */}
      <section
        className="rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Estimated 1RM</p>
          {names.length > 0 && (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="max-w-[60%] text-[0.78rem]"
              data-no-vitality
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.3rem 0.5rem", color: "var(--color-fg)" }}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-4">
          {line.length < 2 ? (
            <p className="text-[0.82rem] text-muted">Log this lift on more days to see a trend.</p>
          ) : (
            <Line values={line} />
          )}
        </div>
      </section>

      {/* measurements */}
      <Link
        href="/train/measurements"
        className="flex items-center justify-between rounded-2xl border p-5"
        data-no-vitality
        style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
      >
        <span>
          <span className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Body measurements</span>
          <span className="mt-1 block text-[0.9rem] font-medium">
            {latest?.weight_kg != null
              ? `${Math.round(kgToDisplay(latest.weight_kg, unit))} ${unit}`
              : "Log your first measurement"}
          </span>
        </span>
        <span className="text-muted">→</span>
      </Link>
    </div>
  );
}

function Line({ values }: { values: number[] }) {
  const W = 320;
  const H = 130;
  const pad = 8;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = pts.join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
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
