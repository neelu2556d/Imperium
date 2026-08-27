"use client";

import CountUp from "@/components/motion/CountUp";

interface CaloriesCardProps {
  consumed: number;
  goal: number;
}

/**
 * Today view — the calories card. Big consumed figure, remaining vs goal, and a
 * thin progress bar that greens up to 80%, ambers past it, and turns danger red
 * once the day's goal is exceeded.
 */
export default function CaloriesCard({ consumed, goal }: CaloriesCardProps) {
  const safeGoal = goal > 0 ? goal : 1;
  const pct = Math.min(100, (consumed / safeGoal) * 100);
  const remaining = Math.round(goal - consumed);
  const over = consumed > goal;

  const fill = over
    ? "var(--danger)"
    : pct > 80
      ? "var(--color-amber)"
      : "var(--accent)";

  return (
    <section
      className="rounded-2xl border p-6"
      data-no-vitality
      style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="mono tabular-nums text-[1.75rem] leading-none text-white">
          <CountUp value={Math.round(consumed)} restartKey={consumed} />
        </span>
        <span className="text-sm text-muted">kcal</span>
      </div>
      <p className="mt-1.5 text-[0.8rem] text-muted">
        of {Math.round(goal).toLocaleString()} kcal ·{" "}
        {over ? (
          <span style={{ color: "var(--danger)" }}>{Math.abs(remaining)} over</span>
        ) : (
          <>remaining: {remaining.toLocaleString()}</>
        )}
      </p>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: fill,
            transition: "width 400ms var(--ease-premium), background 300ms",
          }}
        />
      </div>
    </section>
  );
}
