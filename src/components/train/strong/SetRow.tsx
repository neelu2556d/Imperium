"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/train/icons";
import { displayToKg, kgToDisplay, type WeightUnit } from "@/lib/train/settings";
import type { SessionSet } from "@/lib/supabase/workouts";

interface SetRowProps {
  set: SessionSet;
  unit: WeightUnit;
  onCommit: (patch: { weight_kg?: number; reps?: number }) => void;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * One set row in the live workout: set number, weight (in the user's unit),
 * reps, and a complete checkmark. Values are edited locally and committed on
 * blur; completing a set is what fires the rest timer + PR update upstream.
 */
export default function SetRow({ set, unit, onCommit, onToggle, onDelete }: SetRowProps) {
  const [weight, setWeight] = useState(() => fmt(kgToDisplay(set.weight_kg, unit)));
  const [reps, setReps] = useState(() => String(set.reps));

  const commitWeight = () => {
    const kg = displayToKg(Number(weight) || 0, unit);
    onCommit({ weight_kg: kg });
  };
  const commitReps = () => onCommit({ reps: Number(reps) || 0 });

  return (
    <div
      className="grid items-center gap-2 py-1.5"
      style={{ gridTemplateColumns: "28px 1fr 1fr 40px 28px" }}
    >
      <span className="mono text-center text-[0.8rem] tabular-nums text-muted">
        {set.is_warmup ? "W" : set.set_number}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commitWeight}
        className="mono tabular-nums text-center"
        data-no-vitality
        style={inputStyle(set.is_completed)}
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commitReps}
        className="mono tabular-nums text-center"
        data-no-vitality
        style={inputStyle(set.is_completed)}
      />
      <button
        type="button"
        onClick={() => onToggle(!set.is_completed)}
        aria-label={set.is_completed ? "Mark set incomplete" : "Complete set"}
        data-no-vitality
        className="flex h-8 items-center justify-center rounded-md"
        style={{
          border: set.is_completed ? "1px solid var(--accent)" : "1px solid var(--color-border)",
          background: set.is_completed ? "var(--accent)" : "transparent",
          color: set.is_completed ? "var(--accent-ink)" : "var(--color-muted)",
        }}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete set"
        data-no-vitality
        className="flex h-8 items-center justify-center"
        style={{ background: "transparent", border: "none", color: "var(--color-muted)" }}
      >
        <TrashIcon size={15} />
      </button>
    </div>
  );
}

function inputStyle(completed: boolean): React.CSSProperties {
  return {
    background: completed ? "rgb(var(--accent-rgb) / 0.08)" : "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    padding: "0.4rem 0.3rem",
    color: "var(--color-fg)",
  };
}
