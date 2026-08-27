"use client";

import { useRef, useState } from "react";
import { localISODate } from "@/lib/supabase/nutrition";

interface DateNavigatorProps {
  /** Currently selected day, YYYY-MM-DD. */
  selected: string;
  onSelect: (dateISO: string) => void;
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Parses YYYY-MM-DD into a local Date (midnight). */
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday of the week containing `d` (local). */
function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - dow);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/**
 * Sticky week strip (Mon–Sun) for the Fuel diary. The active day is a filled
 * accent circle; tapping any day switches the diary to it. Swiping the strip
 * left/right pages between weeks; the "Today" button snaps back to today.
 */
export default function DateNavigator({ selected, onSelect }: DateNavigatorProps) {
  const today = localISODate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(parseISO(selected)));
  const swipeStart = useRef<number | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (dx > 48) setWeekStart((w) => addDays(w, -7));
    else if (dx < -48) setWeekStart((w) => addDays(w, 7));
  };

  const goToday = () => {
    setWeekStart(mondayOf(new Date()));
    onSelect(today);
  };

  return (
    <div
      className="sticky top-0 z-20 -mx-5 px-5 py-3 md:-mx-8 md:px-8"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
          {weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={goToday}
          data-no-vitality
          className="mono rounded-full px-3 py-1 text-[0.62rem] uppercase tracking-[0.12em]"
          style={{
            border: "1px solid var(--color-border-strong)",
            background: "var(--color-card-elevated)",
            color: "var(--color-muted-strong)",
          }}
        >
          Today
        </button>
      </div>

      <div
        className="mt-2 flex justify-between gap-1 touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {days.map((d, i) => {
          const iso = localISODate(d);
          const active = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              data-no-vitality
              className="flex flex-1 flex-col items-center gap-1"
              style={{ background: "transparent", border: "none", padding: "0.25rem 0" }}
            >
              <span className="text-[0.6rem] uppercase tracking-[0.08em] text-muted">
                {DAY_LETTERS[i]}
              </span>
              <span
                className="mono flex h-9 w-9 items-center justify-center rounded-full text-[0.85rem] tabular-nums"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-ink)" : "var(--color-fg)",
                  border: active
                    ? "1px solid var(--accent)"
                    : isToday
                      ? "1px solid var(--color-border-strong)"
                      : "1px solid transparent",
                }}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
