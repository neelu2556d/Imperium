import type { SplitDay } from "@/lib/split/templates";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A row of seven small circles representing Mon–Sun. Filled mint circles are
 * training days; hollow circles are rest. Selection lifts the fill to full
 * opacity so the pattern reads clearly on the active card.
 */
export default function CadenceDots({
  days,
  active,
}: {
  days: SplitDay[];
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {days.map((day, index) => (
        <span
          key={index}
          className="h-2 w-2 rounded-full"
          style={
            day.isRest
              ? { border: "1px solid var(--color-border-strong)" }
              : {
                  background: "var(--color-mint)",
                  opacity: active ? 1 : 0.75,
                }
          }
          title={`${DAY_LABELS[index]} · ${day.isRest ? "Rest" : day.name}`}
        />
      ))}
    </div>
  );
}
