import type { SVGProps } from "react";

/**
 * Line icons for the /train/session logging screen. Same conventions as the
 * /train and /home icon sets: stroke `currentColor`, scale with `size`,
 * decorative (aria-hidden) by default.
 */

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Back chevron for the "← Today's session" link. */
export function BackIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Info circle (ⓘ) next to an exercise name. */
export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

/** Swap (⇌) — two opposed arrows, opens the replace sheet. */
export function SwapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h13" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H8" />
    </svg>
  );
}

/** History (→) — a clock rewind, opens the past-logs sheet. */
export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Tune (≡) — sliders, reveals the per-exercise set adjuster. */
export function TuneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h11M4 12h16M4 18h8" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

/** Section divider dot above each exercise. */
export function DotIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Checkmark shown on a logged set row. */
export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Gear for the top-right settings affordance. */
export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

/** Search glyph for the swap sheet's search field. */
export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Filled star for the "Finish session ★" button. */
export function StarIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.9 6.1 20.3l1.3-6.5L2.5 9.3l6.6-.8z" />
    </svg>
  );
}

/** Plus/minus for the tune stepper. */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}
