import type { SVGProps } from "react";

/**
 * Line icons specific to the /train dashboard — the adjust/refresh glyph, the
 * settings gear, the day-card collapse chevron, and the FAB plus. They share
 * the /home icon conventions: stroke `currentColor`, scale with `size`, and are
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

/** Circular refresh arrow — the "⟳ Adjust your training" affordance. */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 11a8 8 0 1 0-.9 4.5" />
      <path d="M20 5v5h-5" />
    </svg>
  );
}

/** Settings gear — the gear icon on /home. */
export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

/** Chevron that points down when collapsed; callers rotate it when expanded. */
export function ChevronIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Trash can — the "delete this logged session" affordance. */
export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Edit icon — the "edit this logged session" affordance. */
export function EditIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17.9 10.7 16.3 9.1" />
      <path d="M17.9 14.3 16.3 15.9" />
      <path d="M17.9 7.7 16.3 6.1" />
      <path d="M0 4h2.8a2.1 2.1 0 0 0-.6-4.1L5.6 2 4 4h.3a1 1 0 0 1 .7 1c0 3.5 2.3 6.4 5.4 6.4a1 1 0 0 1 1 1v.3zM4 9.8a1 1 0 0 1 1 1H8a1 1 0 0 1 1 1v.3c0 .6-.4 1-1 1H6a1 1 0 0 1-1-1v-.3z"/>
    </svg>
  );
}

/** Plus icon — the "add new exercise" affordance. */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}