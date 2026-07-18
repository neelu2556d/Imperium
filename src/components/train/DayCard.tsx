"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ChevronIcon } from "@/components/train/icons";
import type { TrainSplitDay } from "@/lib/supabase/train";

interface DayCardProps {
  /** 1-based position in the split, shown as a zero-padded index ("01"). */
  index: number;
  day: TrainSplitDay;
  /** True for the day the user has chosen to train today. */
  isActive: boolean;
  /** True for the day the split naturally lands on today. */
  isScheduled: boolean;
  /** Pick this day as today's session. */
  onSelect: () => void;
}

const MINT = "var(--color-mint)";

/**
 * One day in the horizontally-scrolling split row. Tapping a training day
 * opens its logging session straight away (rest days just mark themselves as
 * today's pick). Collapsed it shows just the day name and its intensity badge;
 * the chevron expands it to reveal the exercise count.
 */
export default function DayCard({
  index,
  day,
  isActive,
  isScheduled,
  onSelect,
}: DayCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(isActive && !day.isRest);

  // Auto-expand whenever this card becomes the active pick. Adjusting state
  // during render (rather than in an effect) avoids a cascading re-render.
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive && !day.isRest) setExpanded(true);
  }

  // Tap = go. Training days open their session immediately; the selection
  // still updates first so the dashboard highlight is right if the user
  // navigates back.
  const activate = () => {
    onSelect();
    if (!day.isRest) router.push(`/train/session/${day.id}`);
  };

  // The active card gets a mint ring; the scheduled day (when not active) gets a
  // fainter outline so the default is still visible.
  const cardStyle: CSSProperties = isActive
    ? { boxShadow: "0 0 0 1px var(--color-mint), 0 0 24px var(--color-mint-glow)" }
    : isScheduled
      ? { boxShadow: "0 0 0 1px var(--color-border-strong)" }
      : {};

  return (
    <div
      role="button"
      tabIndex={0}
      data-no-vitality
      aria-pressed={isActive}
      aria-label={day.isRest ? `${day.name} — rest day` : `Open ${day.name} session`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      className="card relative flex w-40 shrink-0 cursor-pointer flex-col p-3.5 text-left transition-colors hover:border-mint"
      style={{ minHeight: 200, ...cardStyle }}
    >
      {/* header: index + Today pill (left), collapse chevron (right) */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start gap-1.5">
          <span className="mono text-[0.7rem] tracking-widest text-muted">
            {String(index).padStart(2, "0")}
          </span>
          {isActive ? (
            <span
              className="mono rounded-pill px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em]"
              style={{ background: MINT, color: "var(--color-mint-ink)" }}
            >
              Today
            </span>
          ) : (
            isScheduled && (
              <span className="mono rounded-pill border border-border-strong px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Scheduled
              </span>
            )
          )}
        </div>

        {!day.isRest && (
          <button
            type="button"
            data-no-vitality
            aria-label={expanded ? "Collapse day" : "Expand day"}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
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

      {/* tap hint, pinned to the bottom of the active training day */}
      {isActive && !day.isRest && expanded && (
        <span
          className="mono mt-2 flex items-center gap-1 text-left text-[0.62rem] font-medium uppercase tracking-[0.1em]"
          style={{ color: MINT }}
        >
          Tap to open →
        </span>
      )}
    </div>
  );
}
