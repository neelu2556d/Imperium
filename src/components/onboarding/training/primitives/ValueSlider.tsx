"use client";

interface ValueSliderProps {
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  /** Used before the user has touched the slider, so nothing shows selected. */
  fallback: number;
  onChange: (value: number) => void;
  /** Big readout above the track, e.g. "4" or "60 MIN". */
  display: (value: number) => string;
  /** Small caps label under the readout, e.g. "DAYS A WEEK". */
  caption: string;
  /** One-line descriptor for the current value. */
  descriptor: (value: number) => string;
}

/**
 * Native range input restyled with a large mint thumb (see .vt-range in
 * globals.css). Keeping it a real <input type="range"> preserves keyboard and
 * assistive-tech behaviour for free.
 */
export default function ValueSlider({
  min,
  max,
  step,
  value,
  fallback,
  onChange,
  display,
  caption,
  descriptor,
}: ValueSliderProps) {
  const current = value ?? fallback;
  const pct = ((current - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center">
      <div
        className="mono text-6xl font-semibold leading-none"
        style={{ color: "var(--color-mint)" }}
      >
        {display(current)}
      </div>
      <div className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
        {caption}
      </div>
      <div className="mt-1 text-sm text-muted-strong">{descriptor(current)}</div>

      <input
        type="range"
        data-no-vitality
        className="vt-range mt-8 w-full"
        min={min}
        max={max}
        step={step}
        value={current}
        aria-valuetext={display(current)}
        style={{ ["--vt-range-fill" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="mt-2 flex w-full justify-between text-xs text-muted">
        <span>{display(min)}</span>
        <span>{display(max)}</span>
      </div>
    </div>
  );
}
