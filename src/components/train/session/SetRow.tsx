"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/train/session/icons";
import { formatWeight, toRoman } from "@/lib/train/overload";

export interface SetRowProps {
  /** 1-based set index, rendered as a roman numeral. */
  index: number;
  /** Pre-fill weight from the overload rule; null when there's no history. */
  suggestedWeight: number | null;
  prescribedReps: number;
  /** Present once the set has been logged (today, or just now). */
  logged: { weight: number | null; reps: number | null } | null;
  /** Persists the set. Rejects to let the row show it's still unsaved. */
  onLog: (weight: number, reps: number, rpe: number | null) => Promise<void>;
}

const RPE_CHIPS = [6, 7, 8, 9, 10];

/**
 * One prescribed set. Collapsed it shows the suggested load and a "HIT IT →"
 * pill; tapping expands an inline overlay with weight/reps fields, an optional
 * RPE selector, and "LOG IT". Once logged it collapses to the actual numbers in
 * mint with a checkmark, and stays tappable to correct a mistake.
 */
export default function SetRow({
  index,
  suggestedWeight,
  prescribedReps,
  logged,
  onLog,
}: SetRowProps) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(
    logged?.weight != null
      ? String(logged.weight)
      : suggestedWeight != null
        ? String(suggestedWeight)
        : ""
  );
  const [reps, setReps] = useState(
    logged?.reps != null ? String(logged.reps) : String(prescribedReps)
  );
  const [rpe, setRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const roman = toRoman(index);

  const confirm = async () => {
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r)) return;
    setSaving(true);
    try {
      await onLog(w, r, rpe);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ---------- logged (collapsed, mint) ----------
  if (logged && !open) {
    return (
      <button
        type="button"
        data-no-vitality
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md border-0 bg-transparent px-1 py-2 text-left"
        aria-label={`Edit set ${roman}`}
      >
        <span className="mono w-6 shrink-0 text-[0.72rem] lowercase text-muted">
          {roman}
        </span>
        <span
          className="mono flex-1 text-sm tabular-nums"
          style={{ color: "var(--color-mint)" }}
        >
          {formatWeight(logged.weight)}kg × {logged.reps}
        </span>
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "var(--color-mint)", color: "var(--color-mint-ink)" }}
          aria-hidden
        >
          <CheckIcon size={13} strokeWidth={2.4} />
        </span>
      </button>
    );
  }

  // ---------- unlogged, collapsed ----------
  if (!open) {
    return (
      <div className="flex w-full items-center gap-3 px-1 py-2">
        <span className="mono w-6 shrink-0 text-[0.72rem] lowercase text-muted">
          {roman}
        </span>
        <span className="mono flex-1 text-sm tabular-nums text-muted-strong">
          {suggestedWeight != null ? `${formatWeight(suggestedWeight)}kg` : "—"} ×{" "}
          {prescribedReps}
        </span>
        <button
          type="button"
          data-no-vitality
          onClick={() => setOpen(true)}
          className="mono shrink-0 rounded-pill px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] transition-colors"
          style={{
            border: "1px solid var(--color-border-strong)",
            background: "transparent",
            color: "var(--color-mint)",
          }}
        >
          Hit it →
        </button>
      </div>
    );
  }

  // ---------- open: inline input overlay ----------
  return (
    <div
      className="rounded-lg px-2 py-3"
      style={{
        border: "1px solid var(--color-mint)",
        background: "rgba(110,231,183,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="mono w-6 shrink-0 text-[0.72rem] lowercase text-muted">
          {roman}
        </span>

        <label className="flex flex-1 flex-col gap-1">
          <span className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            Weight
          </span>
          <div className="flex items-center gap-1">
            <input
              data-no-vitality
              type="number"
              inputMode="decimal"
              step="0.25"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mono w-full rounded-md px-2 py-1.5 text-sm tabular-nums outline-none"
              style={{
                border: "1px solid var(--color-border-strong)",
                background: "var(--color-card)",
                color: "var(--color-fg)",
              }}
              autoFocus
            />
            <span className="mono text-[0.62rem] text-muted">kg</span>
          </div>
        </label>

        <label className="flex w-20 flex-col gap-1">
          <span className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            Reps
          </span>
          <input
            data-no-vitality
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="mono w-full rounded-md px-2 py-1.5 text-sm tabular-nums outline-none"
            style={{
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-card)",
              color: "var(--color-fg)",
            }}
          />
        </label>
      </div>

      {/* optional RPE selector */}
      <div className="mt-3 flex items-center gap-2">
        <span className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
          RPE
        </span>
        <div className="flex gap-1">
          {RPE_CHIPS.map((v) => {
            const active = rpe === v;
            return (
              <button
                key={v}
                type="button"
                data-no-vitality
                onClick={() => setRpe(active ? null : v)}
                className="mono flex h-6 w-6 items-center justify-center rounded-full text-[0.6rem] tabular-nums transition-colors"
                style={{
                  border: `1px solid ${active ? "var(--color-mint)" : "var(--color-border-strong)"}`,
                  background: active ? "var(--color-mint)" : "transparent",
                  color: active ? "var(--color-mint-ink)" : "var(--color-muted-strong)",
                }}
                aria-pressed={active}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          data-no-vitality
          onClick={() => setOpen(false)}
          className="mono rounded-pill px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted transition-colors"
          style={{ border: "1px solid var(--color-border-strong)", background: "transparent" }}
        >
          Cancel
        </button>
        <button
          type="button"
          data-no-vitality
          onClick={confirm}
          disabled={saving}
          className="mono flex-1 rounded-pill px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
          style={{
            background: "var(--color-mint)",
            color: "var(--color-mint-ink)",
            border: "1px solid transparent",
          }}
        >
          {saving ? "Logging…" : "Log it"}
        </button>
      </div>
    </div>
  );
}
