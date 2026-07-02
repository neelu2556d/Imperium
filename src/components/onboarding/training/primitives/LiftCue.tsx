"use client";

import { useState } from "react";

interface LiftCueProps {
  word: string;
  cue: string;
}

/**
 * An inline, tappable word inside a subtitle. Tapping toggles a small popover
 * with a one-line form cue for that lift. Closes on blur (tap-away).
 */
export default function LiftCue({ word, cue }: LiftCueProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        data-no-vitality
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="cursor-pointer font-medium underline decoration-dotted underline-offset-2"
        style={{ color: "var(--color-mint)" }}
      >
        {word}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border p-2.5 text-center text-xs leading-snug"
          style={{
            borderColor: "var(--color-border-strong)",
            background: "var(--color-bg-elevated)",
            color: "var(--color-fg)",
            boxShadow: "var(--shadow-glass)",
          }}
        >
          <span className="mb-0.5 block font-semibold capitalize" style={{ color: "var(--color-mint)" }}>
            {word}
          </span>
          {cue}
        </span>
      )}
    </span>
  );
}
