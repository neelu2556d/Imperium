"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/vitals/SectionCard";
import EditGoalSheet from "@/components/vitals/EditGoalSheet";
import BottomSheet from "@/components/vitals/BottomSheet";
import { DropletIcon } from "@/components/vitals/icons";
import {
  addWater,
  fetchWater,
  saveWaterGoal,
  type WaterState,
} from "@/lib/supabase/vitals";

const QUICK_ADDS = [0.25, 0.5, 0.75]; // litres — labelled in ml

function fmtL(l: number): string {
  return Number(l.toFixed(2)).toString();
}

export default function WaterSection() {
  const [state, setState] = useState<WaterState | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("300");
  const [busy, setBusy] = useState(false);

  const load = () => fetchWater().then(setState);
  useEffect(() => {
    load();
  }, []);

  const goal = state?.goal ?? 3.5;
  const total = state?.today ?? 0;
  const pct = goal > 0 ? Math.min(1, total / goal) : 0;

  const add = async (liters: number) => {
    if (!state || busy || liters <= 0) return;
    setBusy(true);
    // optimistic
    setState({ ...state, today: state.today + liters });
    try {
      await addWater(liters, goal);
      await load();
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  };

  const confirmCustom = async () => {
    const ml = Number(custom);
    if (!Number.isFinite(ml) || ml <= 0) return;
    setCustomOpen(false);
    await add(ml / 1000);
  };

  return (
    <SectionCard
      icon={<DropletIcon size={20} />}
      title="Water"
      right={
        <button
          type="button"
          onClick={() => setEditingGoal(true)}
          data-no-vitality
          className="mono border-0 bg-transparent p-0 text-[0.62rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
        >
          Edit goal
        </button>
      }
    >
      <div className="flex items-center gap-6">
        {/* vertical bottle fill */}
        <WaterBottle pct={pct} />

        <div className="min-w-0 flex-1">
          <p className="mono text-3xl tabular-nums" style={{ color: "var(--color-mint)" }}>
            {fmtL(total)}L
          </p>
          <p className="mono mt-1 text-sm text-muted">/ {fmtL(goal)}L goal</p>
          <p className="mono mt-3 text-[0.7rem] text-muted">
            {Math.round(pct * 100)}% of today&apos;s goal
          </p>
        </div>
      </div>

      {/* quick-add buttons */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {QUICK_ADDS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => add(l)}
            disabled={busy}
            className="mono text-[0.72rem]"
            data-no-vitality
            style={quickStyle}
          >
            +{l * 1000}ml
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          disabled={busy}
          className="mono text-[0.72rem]"
          data-no-vitality
          style={quickStyle}
        >
          Custom
        </button>
      </div>

      {editingGoal && (
        <EditGoalSheet
          title="Water goal"
          label="Litres per day"
          unit="L"
          initial={goal}
          step={0.1}
          min={0.5}
          onSave={async (v) => {
            await saveWaterGoal(v);
            setState((s) => (s ? { ...s, goal: v } : s));
          }}
          onClose={() => setEditingGoal(false)}
        />
      )}

      {customOpen && (
        <BottomSheet title="Custom amount" onClose={() => setCustomOpen(false)}>
          <label className="mono mt-4 block text-[0.7rem] uppercase tracking-[0.12em] text-muted">
            Millilitres
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={custom}
              step={50}
              min={1}
              autoFocus
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmCustom()}
              className="mono w-full text-lg tabular-nums"
              data-no-vitality
              style={{ ...inputBase }}
            />
            <span className="mono text-sm text-muted">ml</span>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setCustomOpen(false)}
              className="flex-1"
              data-no-vitality
              style={{ border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-fg)" }}
            >
              Cancel
            </button>
            <button type="button" onClick={confirmCustom} className="btn-primary flex-1">
              Add
            </button>
          </div>
        </BottomSheet>
      )}
    </SectionCard>
  );
}

const quickStyle: React.CSSProperties = {
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card-elevated)",
  color: "var(--color-fg)",
  padding: "0.55rem 0.25rem",
};

const inputBase: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.6875rem 0.75rem",
  color: "var(--color-fg)",
};

/** Bottle outline that fills bottom→top in mint by `pct` (0..1). */
function WaterBottle({ pct }: { pct: number }) {
  const clipId = "water-fill-clip";
  // Bottle inner region: x 8..40, y 16..104 (viewBox 48x116).
  const innerTop = 16;
  const innerBottom = 104;
  const fillTop = innerBottom - (innerBottom - innerTop) * pct;

  return (
    <svg width="52" height="120" viewBox="0 0 48 116" aria-hidden className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          {/* rounded bottle body + neck */}
          <path d="M16 6 h16 v6 a12 12 0 0 1 6 10 v78 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10 v-78 a12 12 0 0 1 6 -10 z" />
        </clipPath>
      </defs>

      {/* fill (clipped to bottle shape) */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="48" height="116" fill="var(--color-card-elevated)" />
        <rect
          x="0"
          y={fillTop}
          width="48"
          height={innerBottom - fillTop + 2}
          fill="var(--color-mint)"
          opacity="0.85"
          style={{ transition: "y 480ms var(--ease-premium), height 480ms var(--ease-premium)" }}
        />
      </g>

      {/* bottle outline */}
      <path
        d="M16 6 h16 v6 a12 12 0 0 1 6 10 v78 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10 v-78 a12 12 0 0 1 6 -10 z"
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth="2"
      />
      {/* cap */}
      <rect x="17" y="1" width="14" height="6" rx="2" fill="var(--color-border-strong)" />
    </svg>
  );
}
