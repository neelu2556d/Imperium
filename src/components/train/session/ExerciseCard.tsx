"use client";

import { useState } from "react";
import SetRow from "@/components/train/session/SetRow";
import {
  DotIcon,
  HistoryIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
  SwapIcon,
  TuneIcon,
} from "@/components/train/session/icons";
import { formatWeight, suggestWeight } from "@/lib/train/overload";
import type { SessionExercise } from "@/lib/supabase/session";

/** A set logged this session, keyed for the card by its 1-based set number. */
export type LoggedMap = Map<number, { weight: number | null; reps: number | null }>;

interface ExerciseCardProps {
  exercise: SessionExercise;
  /** Live set count (tune can nudge it above/below the prescription). */
  setCount: number;
  deload: boolean;
  logged: LoggedMap;
  onLogSet: (
    setNumber: number,
    weight: number,
    reps: number,
    rpe: number | null
  ) => Promise<void>;
  onSwap: () => void;
  onHistory: () => void;
  onSetCountChange: (next: number) => void;
}

const TIER_NUMBER: Record<string, number> = {
  primary: 1,
  secondary: 2,
  accessory: 3,
};

function tierNumber(tier: string | null): number {
  return TIER_NUMBER[(tier ?? "").trim().toLowerCase()] ?? 1;
}

/**
 * One exercise block in the session: a section divider, the name + info toggle,
 * the "TIER N · LAST xkg" sub-label, the swap/history/tune action column, and a
 * row per prescribed set. Tune reveals an inline stepper that adjusts how many
 * sets show for this session; info toggles the form cue.
 */
export default function ExerciseCard({
  exercise,
  setCount,
  deload,
  logged,
  onLogSet,
  onSwap,
  onHistory,
  onSetCountChange,
}: ExerciseCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showTune, setShowTune] = useState(false);

  const suggestion = suggestWeight({
    last: exercise.last,
    isCompound: exercise.isCompound,
    deload,
  });

  const actionBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border text-muted transition-colors hover:text-fg";
  const actionStyle = {
    borderColor: "var(--color-border-strong)",
    background: "transparent",
  } as const;

  return (
    <section
      className="border-0 bg-transparent p-0"
      data-no-vitality
      aria-label={exercise.name}
    >
      {/* section divider */}
      <div className="my-4 flex items-center gap-2" aria-hidden>
        <span className="text-muted" style={{ opacity: 0.5 }}>
          <DotIcon size={12} />
        </span>
        <span
          className="h-px flex-1"
          style={{ background: "var(--color-border)" }}
        />
      </div>

      <div className="card p-4" data-no-vitality>
        {/* header row: name + info, actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="truncate text-base font-medium"
                data-no-vitality
                style={{ fontFamily: "var(--font-sans)", fontStyle: "normal" }}
              >
                {exercise.name}
              </h3>
              <button
                type="button"
                data-no-vitality
                aria-label={`About ${exercise.name}`}
                aria-expanded={showInfo}
                onClick={() => setShowInfo((v) => !v)}
                className="shrink-0 border-0 bg-transparent p-0 text-muted transition-colors hover:text-fg"
              >
                <InfoIcon size={16} />
              </button>
            </div>
            <p className="mono mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-muted">
              Tier {tierNumber(exercise.tier)} ·{" "}
              {exercise.lastWeight != null
                ? `Last ${formatWeight(exercise.lastWeight)}kg`
                : "New lift"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-no-vitality
              aria-label="Swap exercise"
              onClick={onSwap}
              className={actionBtn}
              style={actionStyle}
            >
              <SwapIcon size={16} />
            </button>
            <button
              type="button"
              data-no-vitality
              aria-label="Exercise history"
              onClick={onHistory}
              className={actionBtn}
              style={actionStyle}
            >
              <HistoryIcon size={16} />
            </button>
            <button
              type="button"
              data-no-vitality
              aria-label="Adjust sets"
              aria-expanded={showTune}
              onClick={() => setShowTune((v) => !v)}
              className={actionBtn}
              style={{
                ...actionStyle,
                borderColor: showTune
                  ? "var(--color-mint)"
                  : "var(--color-border-strong)",
                color: showTune ? "var(--color-mint)" : "var(--color-muted)",
              }}
            >
              <TuneIcon size={16} />
            </button>
          </div>
        </div>

        {/* info: form cue */}
        {showInfo && (
          <p
            className="mt-2 rounded-md p-2.5 text-xs leading-relaxed text-muted-strong"
            style={{ background: "var(--color-card)" }}
            role="note"
          >
            {exercise.formCue ?? "Focus on controlled reps and full range."}
          </p>
        )}

        {/* tune: set-count stepper */}
        {showTune && (
          <div
            className="mt-3 flex items-center justify-between rounded-md p-2.5"
            style={{ background: "var(--color-card)" }}
          >
            <span className="mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              Sets this session
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-no-vitality
                aria-label="Remove a set"
                onClick={() => onSetCountChange(Math.max(1, setCount - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border text-muted"
                style={actionStyle}
              >
                <MinusIcon size={14} />
              </button>
              <span className="mono w-4 text-center text-sm tabular-nums">
                {setCount}
              </span>
              <button
                type="button"
                data-no-vitality
                aria-label="Add a set"
                onClick={() => onSetCountChange(Math.min(12, setCount + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border text-muted"
                style={actionStyle}
              >
                <PlusIcon size={14} />
              </button>
            </div>
          </div>
        )}

        {/* set rows */}
        <div className="mt-3 flex flex-col">
          {Array.from({ length: setCount }, (_, i) => {
            const setNumber = i + 1;
            const done = logged.get(setNumber) ?? null;
            return (
              <SetRow
                key={setNumber}
                index={setNumber}
                suggestedWeight={done?.weight ?? suggestion}
                prescribedReps={exercise.prescribedReps}
                logged={done}
                onLog={(w, r, rpe) => onLogSet(setNumber, w, r, rpe)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
