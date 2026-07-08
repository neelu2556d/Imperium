"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/vitals/SectionCard";
import EditGoalSheet from "@/components/vitals/EditGoalSheet";
import { MoonIcon, PlusIcon } from "@/components/vitals/icons";
import {
  fetchSleep,
  logSleep,
  saveSleepGoal,
  type SleepState,
} from "@/lib/supabase/vitals";
import { pushToast } from "@/lib/toast";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function todayLabel(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Hours between two "HH:MM" times, wrapping past midnight (bed → wake). */
function hoursBetween(asleep: string, woke: string): number | null {
  if (!asleep || !woke) return null;
  const [ah, am] = asleep.split(":").map(Number);
  const [wh, wm] = woke.split(":").map(Number);
  if ([ah, am, wh, wm].some((n) => !Number.isFinite(n))) return null;
  let mins = wh * 60 + wm - (ah * 60 + am);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function fmtHours(h: number): string {
  return Number(h.toFixed(1)).toString();
}

export default function SleepSection() {
  const [state, setState] = useState<SleepState | null>(null);
  const [logging, setLogging] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  const [asleep, setAsleep] = useState("23:00");
  const [woke, setWoke] = useState("06:30");
  const [saving, setSaving] = useState(false);

  const load = () => fetchSleep().then(setState);
  useEffect(() => {
    load();
  }, []);

  const computed = hoursBetween(asleep, woke);

  const confirm = async () => {
    if (computed == null || !state || saving) return;
    setSaving(true);
    try {
      await logSleep(computed, state.goal);
      setLogging(false);
      await load();
    } catch {
      pushToast("Couldn't log your sleep. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const goal = state?.goal ?? 7.15;
  const today = state?.today ?? null;
  const pct = today != null ? Math.min(1, today / goal) : 0;

  return (
    <SectionCard
      icon={<MoonIcon size={20} />}
      title="Sleep"
      right={
        <>
          <button
            type="button"
            onClick={() => setEditingGoal(true)}
            data-no-vitality
            className="mono border-0 bg-transparent p-0 text-[0.62rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
          >
            Edit goal
          </button>
          <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
            {todayLabel()}
          </span>
        </>
      }
    >
      {/* arc gauge */}
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 200 116" className="w-full" aria-hidden>
          <path
            d="M 12 104 A 88 88 0 0 1 188 104"
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
          />
          <path
            d="M 12 104 A 88 88 0 0 1 188 104"
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct * 100} 100`}
            style={{
              filter: "drop-shadow(0 0 6px var(--color-mint-glow))",
              transition: "stroke-dasharray 480ms var(--ease-premium)",
            }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span
            className="mono text-4xl tabular-nums"
            style={{ color: today != null ? "var(--color-mint)" : "var(--color-muted)" }}
          >
            {today != null ? fmtHours(today) : "—"}
          </span>
          <span className="mono mt-0.5 text-[0.68rem] text-muted">
            / {goal} hrs goal
          </span>
        </div>
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
          <PlusIcon size={15} /> Log sleep
        </button>
      ) : (
        <div
          className="mt-5 rounded-xl border p-4"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-card-elevated)",
          }}
        >
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mono block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                Fell asleep
              </span>
              <input
                type="time"
                value={asleep}
                onChange={(e) => setAsleep(e.target.value)}
                className="mono mt-1 w-full tabular-nums"
                data-no-vitality
                style={inputStyle}
              />
            </label>
            <label className="flex-1">
              <span className="mono block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                Woke up
              </span>
              <input
                type="time"
                value={woke}
                onChange={(e) => setWoke(e.target.value)}
                className="mono mt-1 w-full tabular-nums"
                data-no-vitality
                style={inputStyle}
              />
            </label>
          </div>

          <p className="mono mt-3 text-center text-sm text-muted">
            {computed != null ? (
              <>
                That&apos;s{" "}
                <span style={{ color: "var(--color-mint)" }}>
                  {fmtHours(computed)} hrs
                </span>
              </>
            ) : (
              "Enter both times"
            )}
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setLogging(false)}
              className="flex-1"
              data-no-vitality
              style={{
                border: "1px solid var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-fg)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={computed == null || saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* 7-day bars */}
      {state && <SleepBars week={state.week} goal={goal} />}

      {editingGoal && (
        <EditGoalSheet
          title="Sleep goal"
          label="Hours per night"
          unit="hrs"
          initial={goal}
          step={0.05}
          min={1}
          onSave={async (v) => {
            await saveSleepGoal(v);
            setState((s) => (s ? { ...s, goal: v } : s));
          }}
          onClose={() => setEditingGoal(false)}
        />
      )}
    </SectionCard>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.5rem 0.6rem",
  color: "var(--color-fg)",
};

/** 7-night bar chart: mint bars, amber when below goal, dashed goal line. */
function SleepBars({
  week,
  goal,
}: {
  week: { date: string; hours: number | null }[];
  goal: number;
}) {
  const W = 300;
  const H = 96;
  const padB = 16;
  const padT = 8;
  const innerH = H - padB - padT;
  const slot = W / week.length;
  const barW = slot * 0.5;
  const max = Math.max(goal * 1.15, ...week.map((d) => d.hours ?? 0), 8);
  const y = (h: number) => padT + (1 - h / max) * innerH;
  const goalY = y(goal);

  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Last 7 nights of sleep">
        {/* goal line */}
        <line
          x1={0}
          y1={goalY}
          x2={W}
          y2={goalY}
          stroke="var(--color-mint-soft)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        {week.map((d, i) => {
          const cx = i * slot + slot / 2;
          if (d.hours == null) {
            return (
              <g key={d.date}>
                <rect
                  x={cx - barW / 2}
                  y={y(0.4)}
                  width={barW}
                  height={2}
                  rx={1}
                  fill="var(--color-border-strong)"
                />
                <text x={cx} y={H - 3} textAnchor="middle" className="mono" fontSize="8" fill="var(--color-muted)">
                  {DOW[weekday(d.date)]}
                </text>
              </g>
            );
          }
          const top = y(d.hours);
          const below = d.hours < goal;
          return (
            <g key={d.date}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(2, padT + innerH - top)}
                rx={2}
                fill={below ? "var(--color-amber)" : "var(--color-mint)"}
                opacity={below ? 0.85 : 1}
              />
              <text x={cx} y={H - 3} textAnchor="middle" className="mono" fontSize="8" fill="var(--color-muted)">
                {DOW[weekday(d.date)]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Weekday index (0=Sun) from a local YYYY-MM-DD. */
function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
}
