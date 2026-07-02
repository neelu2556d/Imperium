/**
 * Small line-icon set for the training quiz. One component, keyed by name, so
 * option configs can reference an icon by string. All icons are 24x24 stroke
 * glyphs that inherit `currentColor`.
 */

export type IconName =
  // step 1 — experience
  | "sprout"
  | "calendar"
  | "flame"
  | "rotate-back"
  | "refresh"
  // step 2 — barbell confidence
  | "shield-check"
  | "trending-up"
  | "book"
  | "sliders"
  // step 3 sub-label
  | "bolt"
  // step 4 — goal
  | "barbell"
  | "muscle"
  | "leaf"
  | "recomp"
  | "heart"
  // step 6 — split
  | "layers"
  | "split"
  | "orbit"
  | "sparkles"
  // step 7 — equipment preference
  | "dumbbell"
  | "cog"
  | "cable"
  | "shuffle"
  // step 13 — lifestyle
  | "desk"
  | "walk"
  | "sport"
  | "run"
  | "bike"
  | "pulse"
  // misc
  | "plus"
  | "check";

const PATHS: Record<IconName, React.ReactNode> = {
  sprout: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" />
      <path d="M12 10c0-2.5 2-4.5 5-4.5 0 2.5-2 4.5-5 4.5Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  flame: (
    <path d="M12 3c1 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1.5.6-2.5 1.3-3.3C10 8 11 6 12 3Z" />
  ),
  "rotate-back": (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v5h-5" />
    </>
  ),
  "shield-check": (
    <>
      <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  "trending-up": (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
      <path d="M5 18a2 2 0 0 1 2-2h11" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  bolt: <path d="M13 3 5 13h6l-1 8 8-11h-6l1-7Z" />,
  barbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </>
  ),
  muscle: (
    <path d="M6 20v-5c0-4 2-7 6-7 1.5 0 2.5-.7 2.5-2 1.5.5 2.5 2 2.5 4 0 5-3 8-8 8-2 0-3-.5-3-2Z" />
  ),
  leaf: (
    <>
      <path d="M20 4C9 4 4 9 4 18c9 0 14-5 16-14Z" />
      <path d="M4 20c4-6 8-9 13-11" />
    </>
  ),
  recomp: (
    <>
      <path d="M4 8h13a3 3 0 0 1 0 6H7" />
      <path d="M7 5 4 8l3 3M17 19l3-3-3-3" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  split: (
    <>
      <path d="M12 4v16" />
      <rect x="3" y="7" width="6" height="10" rx="1" />
      <rect x="15" y="7" width="6" height="10" rx="1" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.5 4L18 9.5 13.5 11 12 15l-1.5-4L6 9.5 10.5 8 12 4Z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M4 8v8M7 6v12M17 6v12M20 8v8M7 12h10" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  cable: (
    <>
      <path d="M6 3v5a6 6 0 0 0 12 0V3" />
      <path d="M12 14v7M9 21h6" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 6h4l10 12h4M3 18h4l3-3.5M14 8l3-2M21 6l-3-3M21 18l-3 3" />
    </>
  ),
  desk: (
    <>
      <rect x="4" y="5" width="16" height="10" rx="1" />
      <path d="M4 19h16M8 15v4M16 15v4" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4" r="1.5" />
      <path d="M13 7l-2 4 2 2v6M11 11l-3 2M13 13l3 1 1 4" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18M3 12h18M6 6c3 2 9 2 12 0M6 18c3-2 9-2 12 0" />
    </>
  ),
  run: (
    <>
      <circle cx="15" cy="4" r="1.5" />
      <path d="M15 7l-3 3 1 4 3 3M12 10l-4 1-2 4M13 14l4-1" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17l4-7h5M9 6h3l3 5M14 6h3" />
    </>
  ),
  pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l4 4 10-10" />,
};

export default function TrainingIcon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
