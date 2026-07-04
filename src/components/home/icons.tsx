import type { SVGProps } from "react";

/**
 * Small line icons for the /home dashboard and bottom nav. All stroke
 * `currentColor` so they inherit text color (muted, mint-active, etc.) and
 * scale with the `size` prop. Decorative by default (aria-hidden).
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

export function HouseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function DumbbellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 6.5v11M4 8.5v7M17.5 6.5v11M20 8.5v7M6.5 12h11" />
    </svg>
  );
}

export function WaterDropIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3Z" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c.6 3-1.8 4.2-2.7 6.1A5.5 5.5 0 1 0 18 12c0-2.3-1.2-3.4-2.3-4.6C14.2 6 13.4 4.7 12 3Z" />
      <path d="M12 20a2.5 2.5 0 0 0 2.5-2.5c0-1.4-1.2-2.2-1.7-3-.6.8-1.8 1.5-1.8 3A2.5 2.5 0 0 0 12 20Z" />
    </svg>
  );
}

/** Simplified faceted gem, echoing the ImperiumGem mark for the nav tab. */
export function GemIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 9l7 12 7-12-7-6Z" />
      <path d="M5 9h14M12 3l-3 6 3 12 3-12-3-6Z" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
