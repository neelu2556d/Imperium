"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, UndoIcon } from "@/components/train/session/icons";
import CountUp from "@/components/motion/CountUp";
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
 * One prescribed set, rendered as a full-width card. Unlogged it shows the
 * suggested load in an outlined card with a "hit it →" cue; tapping expands an
 * inline overlay with weight/reps fields, an optional RPE selector, and "LOG
 * IT". Once logged the card fills mint with the actual numbers, a "done" label,
 * and an undo glyph — and stays tappable to correct a mistake.
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

  // Detect the unlogged → logged transition so the mint card can flash and its
  // checkmark can pop in exactly once (not on every re-render of a logged set,
  // e.g. when its neighbours change).
  const wasLogged = useRef(logged != null);
  const [justLogged, setJustLogged] = useState(false);
  useEffect(() => {
    const isLogged = logged != null;
    if (isLogged && !wasLogged.current) {
      setJustLogged(true);
      const id = setTimeout(() => setJustLogged(false), 600);
      wasLogged.current = isLogged;
      return () => clearTimeout(id);
    }
    wasLogged.current = isLogged;
  }, [logged]);

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

  // ---------- logged (collapsed, filled mint card) ----------
  if (logged && !open) {
    return (
      <button
        type="button"
        data-no-vitality
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-4 rounded-2xl border-0 px-5 py-4 text-left transition-transform active:scale-[0.99] ${
          justLogged ? "vt-set-flash" : ""
        }`}
        style={{ background: "var(--color-mint)", color: "var(--color-mint-ink)" }}
        aria-label={`Edit set ${roman}`}
      >
        <span
          className="serif-italic w-5 shrink-0 text-base lowercase"
          data-no-vitality
          style={{ opacity: 0.8 }}
        >
          {roman}
        </span>
        <span className="flex flex-1 items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums leading-none">
            {formatWeight(logged.weight)}
          </span>
          <span className="serif-italic text-xs" data-no-vitality style={{ opacity: 0.75 }}>
            kg
          </span>
          <span className="ml-1.5 text-lg leading-none">× {logged.reps}</span>
        </span>
        {/* checkmark fades in + scales up from 0 on the moment it's logged */}
        <span
          className={justLogged ? "vt-check-pop" : undefined}
          style={{ display: "inline-flex" }}
          aria-hidden
        >
          <CheckIcon size={18} />
        </span>
        <span className="serif-italic text-sm" data-no-vitality>
          done
        </span>
        <UndoIcon size={16} style={{ opacity: 0.75 }} />
      </button>
    );
  }

  // ---------- unlogged, collapsed (outlined card) ----------
  if (!open) {
    return (
      <button
        type="button"
        data-no-vitality
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors hover:border-mint"
        style={{
          border: "1px solid var(--color-border-strong)",
          background: "transparent",
        }}
        aria-label={`Log set ${roman}`}
      >
        <span
          className="serif-italic w-5 shrink-0 text-base lowercase text-muted"
          data-no-vitality
        >
          {roman}
        </span>
        <span className="flex flex-1 items-baseline gap-1 text-muted-strong">
          <span className="text-2xl font-semibold tabular-nums leading-none">
            {suggestedWeight != null ? (
              <CountUp value={suggestedWeight} format={formatWeight} />
            ) : (
              "—"
            )}
          </span>
          <span className="serif-italic text-xs text-muted" data-no-vitality>
            kg
          </span>
          <span className="ml-1.5 text-lg leading-none">× {prescribedReps}</span>
        </span>
        <span
          className="mono shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-mint)" }}
        >
          Hit it →
        </span>
      </button>
    );
  }

  // ---------- open: inline input overlay ----------
  return (
    <div
      className="rounded-2xl px-4 py-4"
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
