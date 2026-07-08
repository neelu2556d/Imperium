"use client";

import { useState } from "react";
import BottomSheet from "@/components/vitals/BottomSheet";
import { pushToast } from "@/lib/toast";

/**
 * A one-field "edit goal" bottom sheet: a labelled number input pre-filled with
 * the current goal, plus Save/Cancel. Used for both the sleep-hours and
 * water-litres goals — the caller owns persistence via `onSave`.
 */
export default function EditGoalSheet({
  title,
  label,
  unit,
  initial,
  step = 0.05,
  min = 0.1,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  unit: string;
  initial: number;
  step?: number;
  min?: number;
  onSave: (value: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= min;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave(Number(parsed.toFixed(2)));
      onClose();
    } catch {
      setSaving(false);
      pushToast("Couldn't save your goal. Try again.");
    }
  };

  return (
    <BottomSheet title={title} onClose={onClose}>
      <label className="mono mt-4 block text-[0.7rem] uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
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

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onClose}
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
          onClick={save}
          disabled={!valid || saving}
          className="btn-primary flex-1"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
      </div>
    </BottomSheet>
  );
}
