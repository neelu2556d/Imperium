"use client";

import { formatClock } from "@/lib/train/settings";

interface RestTimerProps {
  seconds: number;
  onSkip: () => void;
  onAdd: () => void;
}

/** Sticky rest-timer bar shown after completing a set. */
export default function RestTimer({ seconds, onSkip, onAdd }: RestTimerProps) {
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-5">
      <div
        className="flex w-full max-w-md items-center justify-between rounded-full border px-4 py-2.5"
        data-no-vitality
        style={{
          borderColor: "var(--accent)",
          background: "color-mix(in srgb, var(--color-bg-elevated) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "var(--shadow-glass)",
        }}
      >
        <span className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">Rest</span>
        <span className="mono text-lg tabular-nums" style={{ color: "var(--accent)" }}>
          {formatClock(seconds)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            data-no-vitality
            className="mono rounded-full border px-2.5 py-1 text-[0.68rem]"
            style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--color-muted-strong)" }}
          >
            +15s
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-no-vitality
            className="mono rounded-full px-2.5 py-1 text-[0.68rem]"
            style={{ border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
