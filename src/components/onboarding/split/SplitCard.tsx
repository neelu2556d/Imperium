import CadenceDots from "@/components/onboarding/split/CadenceDots";
import type { Difficulty, SplitTemplate } from "@/lib/split/templates";

const DIFFICULTY_STYLE: Record<Difficulty, { label: string; color: string }> = {
  beginner: { label: "BEGINNER", color: "var(--color-muted-strong)" },
  intermediate: { label: "INTERMEDIATE", color: "var(--color-amber)" },
  advanced: { label: "ADVANCED", color: "var(--color-red)" },
};

interface SplitCardProps {
  template: SplitTemplate;
  selected: boolean;
  recommended: boolean;
  tooltipOpen: boolean;
  onSelect: () => void;
  onToggleTooltip: () => void;
}

/**
 * A single split-template card: difficulty badge, info tooltip, italic title +
 * subtitle, frequency label, and a weekly dot-cadence diagram. Selection gives
 * it a mint border + glow; the recommended card carries a "★ recommended" pill.
 *
 * The card itself is the select target; the info icon and its tooltip live in a
 * relative wrapper so we never nest interactive elements inside the button.
 */
export default function SplitCard({
  template,
  selected,
  recommended,
  tooltipOpen,
  onSelect,
  onToggleTooltip,
}: SplitCardProps) {
  const difficulty = DIFFICULTY_STYLE[template.difficulty];

  return (
    <div className="relative">
      <button
        type="button"
        data-no-vitality
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex h-full w-full flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all ${
          selected ? "split-card-selected" : ""
        }`}
        style={{
          borderColor: selected ? "var(--color-mint)" : "var(--color-border)",
          background: selected
            ? "rgba(110, 231, 183, 0.06)"
            : "var(--color-card-elevated)",
        }}
      >
        {/* Header: difficulty badge (info icon is overlaid by the wrapper). */}
        <span
          className="inline-flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
          style={{ color: difficulty.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {difficulty.label}
        </span>

        {recommended && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em]"
            style={{
              background: "var(--color-mint)",
              color: "var(--color-mint-ink)",
            }}
          >
            ★ recommended
          </span>
        )}

        <span className="serif-italic mt-0.5 text-lg leading-tight">
          {template.title}
        </span>
        <span className="serif-italic -mt-1.5 text-[0.8rem] text-muted">
          {template.subtitle}
        </span>

        <span
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--color-muted-strong)" }}
        >
          {template.frequencyLabel}
        </span>

        <div className="mt-auto pt-1">
          <CadenceDots days={template.days} active={selected} />
        </div>
      </button>

      {/* Info trigger — kept outside the select button to avoid nested buttons. */}
      <button
        type="button"
        data-no-vitality
        aria-label={`About ${template.title}`}
        aria-expanded={tooltipOpen}
        onClick={onToggleTooltip}
        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors"
        style={{ color: tooltipOpen ? "var(--color-mint)" : "var(--color-muted)" }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>

      {tooltipOpen && (
        <div
          role="tooltip"
          className="absolute right-2 top-9 z-10 w-[85%] rounded-lg p-2.5 text-[0.7rem] leading-snug text-muted-strong shadow-lg"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-strong)",
          }}
        >
          {template.tooltip}
        </div>
      )}
    </div>
  );
}
