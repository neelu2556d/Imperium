import TrainingIcon, {
  type IconName,
} from "@/components/onboarding/training/primitives/TrainingIcon";

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: IconName;
  disabled?: boolean;
  /** Show a mint checkmark when selected (step 12). */
  checkOnSelect?: boolean;
}

/**
 * A toggle pill used by the multi-select steps (body bias, limitations).
 * Selected = mint border + mint text, optionally a filled mint background with
 * a checkmark. Opts out of global button styling.
 */
export default function Chip({
  label,
  selected,
  onToggle,
  icon,
  disabled,
  checkOnSelect,
}: ChipProps) {
  const filled = checkOnSelect && selected;
  return (
    <button
      type="button"
      data-no-vitality
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40"
      style={{
        borderColor: selected ? "var(--color-mint)" : "var(--color-border-strong)",
        background: filled ? "var(--color-mint)" : "transparent",
        color: filled
          ? "var(--color-mint-ink)"
          : selected
            ? "var(--color-mint)"
            : "var(--color-muted-strong)",
      }}
    >
      {checkOnSelect && selected ? (
        <TrainingIcon name="check" size={15} />
      ) : (
        icon && <TrainingIcon name={icon} size={15} />
      )}
      {label}
    </button>
  );
}
