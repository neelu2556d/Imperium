import type { SVGProps } from "react";

/**
 * Line icons for the /vitals tab. Same conventions as the /train icon sets:
 * stroke `currentColor`, scale with `size`, decorative (aria-hidden) by default.
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

/** Crescent moon — Sleep section. */
export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** Droplet — Water section. */
export function DropletIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.7s6 6.3 6 10.3a6 6 0 0 1-12 0c0-4 6-10.3 6-10.3z" />
    </svg>
  );
}

/** Scale — Body Weight section. */
export function ScaleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M12 8a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3z" />
      <path d="M12 8V6" />
    </svg>
  );
}

/** Camera — Progress Photos section. */
export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8a2 2 0 0 1 2-2h1.2l1-1.5a1 1 0 0 1 .84-.5h5.92a1 1 0 0 1 .84.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

/** Plus — the "log/add" affordances. */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Close (×) — dismiss the full-screen photo / sheets. */
export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Pencil — the "Edit goal" affordance. */
export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
