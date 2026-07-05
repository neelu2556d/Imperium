import type { MuscleGroup } from "@/lib/split/exerciseCatalog";

/**
 * A small line glyph hinting at the muscle group for an exercise row. Purely
 * decorative (the group name is available in the tooltip), so it's aria-hidden.
 * Falls back to a neutral dot for an unknown group.
 */
export default function MuscleIcon({
  group,
  size = 16,
}: {
  group: MuscleGroup | null;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (group) {
    case "Chest":
      return (
        <svg {...common}>
          <path d="M4 7h16v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Z" />
          <path d="M12 7v9" />
        </svg>
      );
    case "Shoulders":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case "Back":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M8 6 5 12l3 3M16 6l3 6-3 3" />
        </svg>
      );
    case "Legs":
      return (
        <svg {...common}>
          <path d="M9 3v7l-2 11M15 3v7l2 11" />
          <path d="M9 10h6" />
        </svg>
      );
    case "Glutes":
      return (
        <svg {...common}>
          <path d="M12 4v6" />
          <path d="M6 10a6 6 0 0 0 12 0" />
          <path d="M7 20a5 5 0 0 1 10 0" />
        </svg>
      );
    case "Calves":
      return (
        <svg {...common}>
          <path d="M10 3c0 4 3 6 3 10s-3 4-3 8" />
          <path d="M13 13c2 .5 4 2 4 4" />
        </svg>
      );
    case "Arms":
      return (
        <svg {...common}>
          <path d="M6 8v4a4 4 0 0 0 4 4h2" />
          <path d="M12 16a4 4 0 0 0 4-4l1-4" />
          <circle cx="18" cy="6" r="1.5" />
        </svg>
      );
    case "Core":
      return (
        <svg {...common}>
          <rect x="8" y="4" width="8" height="16" rx="3" />
          <path d="M8 10h8M8 14h8M12 4v16" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
