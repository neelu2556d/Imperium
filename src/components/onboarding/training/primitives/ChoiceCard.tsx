import TrainingIcon, {
  type IconName,
} from "@/components/onboarding/training/primitives/TrainingIcon";

interface ChoiceCardProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  selected: boolean;
  onSelect: () => void;
  /** Newsreader-italic title (step 11). */
  italicTitle?: boolean;
  /** Mint checkmark badge in the top-right corner when selected (step 4). */
  checkBadge?: boolean;
}

/**
 * A single-select answer card: icon (optional) + bold title + subtitle.
 * Opts out of the global button styling so it reads as a rectangular card;
 * selection gives it a mint border and a soft mint wash.
 */
export default function ChoiceCard({
  title,
  subtitle,
  icon,
  selected,
  onSelect,
  italicTitle,
  checkBadge,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      data-no-vitality
      aria-pressed={selected}
      onClick={onSelect}
      className="group relative flex h-full w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors"
      style={{
        borderColor: selected ? "var(--color-mint)" : "var(--color-border)",
        background: selected
          ? "rgba(110, 231, 183, 0.06)"
          : "var(--color-card-elevated)",
      }}
    >
      {checkBadge && selected && (
        <span
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "var(--color-mint)", color: "var(--color-mint-ink)" }}
        >
          <TrainingIcon name="check" size={13} />
        </span>
      )}

      {icon && (
        <span
          className="transition-colors"
          style={{ color: selected ? "var(--color-mint)" : "var(--color-muted-strong)" }}
        >
          <TrainingIcon name={icon} size={22} />
        </span>
      )}

      <span
        className={`text-[0.95rem] font-semibold leading-tight ${
          italicTitle ? "serif-italic text-lg font-normal" : ""
        }`}
      >
        {title}
      </span>

      {subtitle && (
        <span className="text-[0.8rem] leading-snug text-muted">{subtitle}</span>
      )}
    </button>
  );
}
