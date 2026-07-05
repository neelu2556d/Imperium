"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ChevronIcon } from "@/components/train/icons";
import type { TrainSplitDay } from "@/lib/supabase/train";

interface DayCardProps {
  /** 1-based position in the split, shown as a zero-padded index ("01"). */
  index: number;
  day: TrainSplitDay;
  /** True for the card the split lands on today. */
  isToday: boolean;
}

const MINT = "var(--color-mint)";

/**
 * One day in the horizontally-scrolling split row. Collapsed it shows just the
 * day name and its intensity badge; expanded (the default for today) it also
 * reveals the exercise count, and — on today's card — a "lock in" prompt that
 * starts the session. Rest days never expand past their REST badge.
 */
export default function DayCard({ index, day, isToday }: DayCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(isToday && !day.isRest);

  const startSession = () => router.push(`/train/session/${day.id}`);

  // Today's card gets a mint ring; rest-day highlight rides the same flag.
  const cardStyle: CSSProperties = isToday
    ? { boxShadow: "0 0 0 1px var(--color-mint), 0 0 24px var(--color-mint-glow)" }
    : {};

  return (
    <div
      className="card relative flex w-40 shrink-0 flex-col p-3.5"
      style={{ minHeight: 200, ...cardStyle }}
    >
      {/* header: index + Today pill (left), collapse chevron (right) */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start gap-1.5">
          <span className="mono text-[0.7rem] tracking-widest text-muted">
            {String(index).padStart(2, "0")}
          </span>
          {isToday && (
            <span
              className="mono rounded-pill px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em]"
              style={{ background: MINT, color: "var(--color-mint-ink)" }}
            >
              Today
            </span>
          )}
        </div>

        {!day.isRest && (
          <button
            type="button"
            data-no-vitality
            aria-label={expanded ? "Collapse day" : "Expand day"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:text-fg"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            <ChevronIcon
              size={16}
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform var(--duration-DEFAULT) var(--ease-DEFAULT)",
              }}
            />
          </button>
        )}
      </div>

      {/* body: day name + intensity badge */}
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="serif-italic text-2xl leading-tight" data-no-vitality>
          {day.name}
        </h3>
        <span
          className="mono mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
          style={{ color: day.isRest ? "var(--color-muted)" : MINT }}
        >
          {day.isRest ? "Rest" : "Heavy"}
        </span>

        {/* expanded detail — training days only */}
        {!day.isRest && expanded && (
          <p className="mono mt-3 text-[0.62rem] uppercase tracking-[0.12em] text-muted">
            {day.exerciseCount} {day.exerciseCount === 1 ? "Exercise" : "Exercises"}
          </p>
        )}
      </div>

      {/* today's lock-in prompt, pinned to the bottom */}
      {isToday && !day.isRest && expanded && (
        <button
          type="button"
          data-no-vitality
          onClick={startSession}
          className="mono mt-2 flex items-center gap-1 text-left text-[0.62rem] font-medium uppercase tracking-[0.1em] transition-colors"
          style={{
            color: MINT,
            background: "transparent",
            border: "none",
            padding: 0,
            justifyContent: "flex-start",
          }}
        >
          Next up: tap to lock in →
        </button>
      )}
    </div>
  );
}
