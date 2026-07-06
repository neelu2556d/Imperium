"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/vitals/SectionCard";
import WeightChart, { type WeightRange } from "@/components/vitals/WeightChart";
import { ScaleIcon, PlusIcon } from "@/components/vitals/icons";
import {
  fetchBodyWeights,
  logBodyWeight,
  localISODate,
  type WeightPoint,
} from "@/lib/supabase/vitals";

const KG_PER_LB = 0.453592;

function fmt1(n: number): string {
  return Number(n.toFixed(1)).toString();
}

export default function BodyWeightSection() {
  const [points, setPoints] = useState<WeightPoint[] | null>(null);
  const [range, setRange] = useState<WeightRange>("3M");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");

  const [logging, setLogging] = useState(false);
  const [entry, setEntry] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetchBodyWeights().then(setPoints);
  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => computeStats(points ?? []), [points]);
  const toDisplay = (kg: number) => (unit === "lb" ? kg / KG_PER_LB : kg);

  const confirm = async () => {
    const n = Number(entry);
    if (!Number.isFinite(n) || n <= 0 || saving) return;
    const kg = unit === "lb" ? n * KG_PER_LB : n;
    setSaving(true);
    try {
      await logBodyWeight(Number(kg.toFixed(2)));
      setLogging(false);
      setEntry("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const loggedToday = points?.some((p) => p.date === localISODate()) ?? false;

  return (
    <SectionCard
      icon={<ScaleIcon size={20} />}
      title="Body Weight"
      right={
        <div className="flex items-center gap-1">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              data-no-vitality
              className="mono rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] transition-colors"
              style={{
                border: "1px solid",
                borderColor: unit === u ? "var(--color-mint)" : "var(--color-border)",
                background: unit === u ? "var(--color-mint)" : "transparent",
                color: unit === u ? "var(--color-mint-ink)" : "var(--color-muted)",
              }}
            >
              {u}
            </button>
          ))}
        </div>
      }
    >
      {/* stat row */}
      <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] tabular-nums">
        <Stat label="Current" value={stats.current != null ? `${fmt1(toDisplay(stats.current))}${unit}` : "—"} accent />
        <Divider />
        <Stat label="7-day avg" value={stats.avg7 != null ? `${fmt1(toDisplay(stats.avg7))}${unit}` : "—"} />
        <Divider />
        <Stat
          label="Change (30d)"
          value={
            stats.change30 != null
              ? `${stats.change30 >= 0 ? "+" : "−"}${fmt1(Math.abs(toDisplay(stats.change30)))}${unit}`
              : "—"
          }
          tone={stats.change30 == null ? "flat" : stats.change30 > 0 ? "up" : stats.change30 < 0 ? "down" : "flat"}
        />
      </div>

      <div className="mt-4">
        {points === null ? (
          <div className="mono flex h-[200px] items-center justify-center text-xs text-muted">
            Loading…
          </div>
        ) : (
          <WeightChart
            points={points}
            range={range}
            onRangeChange={setRange}
            unit={unit}
            height={200}
          />
        )}
      </div>

      {/* log button / inline input */}
      {!logging ? (
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="mono mt-5 w-full text-sm"
          data-no-vitality
          style={{
            border: "1px solid var(--color-border-strong)",
            background: "var(--color-card-elevated)",
            color: "var(--color-fg)",
          }}
        >
          <PlusIcon size={15} /> {loggedToday ? "Update today's weight" : "Log weight"}
        </button>
      ) : (
        <div
          className="mt-5 rounded-xl border p-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
        >
          <label className="mono block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
            Weight ({unit})
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={entry}
              step={0.1}
              min={1}
              autoFocus
              placeholder={unit === "kg" ? "e.g. 78.5" : "e.g. 173"}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
              className="mono w-full text-lg tabular-nums"
              data-no-vitality
              style={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.6875rem 0.75rem",
                color: "var(--color-fg)",
              }}
            />
            <span className="mono text-sm text-muted">{unit}</span>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setLogging(false);
                setEntry("");
              }}
              className="flex-1"
              data-no-vitality
              style={{ border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-fg)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!Number.isFinite(Number(entry)) || Number(entry) <= 0 || saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

interface Stats {
  current: number | null;
  avg7: number | null;
  change30: number | null;
}

/** All maths in kg; the caller converts for display. */
function computeStats(points: WeightPoint[]): Stats {
  if (points.length === 0) return { current: null, avg7: null, change30: null };
  const current = points[points.length - 1].weight;

  const within = (days: number) => {
    const cut = new Date();
    cut.setDate(cut.getDate() - days);
    const cutISO = localISODate(cut);
    return points.filter((p) => p.date >= cutISO);
  };

  const last7 = within(7);
  const avg7 = last7.length
    ? last7.reduce((s, p) => s + p.weight, 0) / last7.length
    : current;

  // Change over 30d: latest minus the earliest log within the last 30 days.
  const last30 = within(30);
  const change30 = last30.length >= 2 ? current - last30[0].weight : null;

  return { current, avg7, change30 };
}

function Stat({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "up" | "down" | "flat";
}) {
  const color = accent
    ? "var(--color-mint)"
    : tone === "up"
      ? "var(--color-mint)"
      : tone === "down"
        ? "var(--color-amber)"
        : "var(--color-fg)";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[0.55rem] uppercase tracking-[0.12em]" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <span style={{ color }}>{value}</span>
    </span>
  );
}

function Divider() {
  return (
    <span aria-hidden style={{ color: "var(--color-border-strong)" }}>
      |
    </span>
  );
}
