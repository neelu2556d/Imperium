"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "@/components/home/icons";

interface BentoCardProps {
  /** Two-digit index shown top-left, e.g. "01". */
  index: string;
  /** Icon rendered in the top-right corner. */
  icon: ReactNode;
  /** Section label shown bottom-left in small-caps italic, e.g. "TRAIN". */
  label: string;
  /** Contextual sub-label next to the section name (already colored). */
  subLabel?: ReactNode;
  /**
   * "Feature" cards (Train/Vitals/Fuel) drop the sub-label and show a larger,
   * brighter serif label so the animated line reads as the card's hero.
   */
  feature?: boolean;
  /** Card body / mini-viz. */
  children: ReactNode;
  /** Route to navigate to on tap. */
  href: string;
  /** Accessible label for the whole card. */
  ariaLabel: string;
  /** One-line summary revealed on long-press. */
  summary?: string;
  /** Grid placement styles (grid-column / grid-row / min-height). */
  style?: React.CSSProperties;
  /** Extra classes on the card root — used to assign a dashboard grid-area. */
  className?: string;
}

const LONG_PRESS_MS = 400;

/**
 * Tappable bento card. Whole card navigates to `href` with a tactile
 * press-scale. A 400ms long-press instead reveals a summary popover and
 * suppresses the navigation. Keyboard accessible via role="button".
 */
export default function BentoCard({
  index,
  icon,
  label,
  subLabel,
  feature = false,
  children,
  href,
  ariaLabel,
  summary,
  style,
  className = "",
}: BentoCardProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!summary) return;
    longPressedRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setShowTooltip(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    clearTimer();
  };

  const navigate = () => {
    // A long-press opened the tooltip instead of navigating.
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`home-card card-raised relative flex h-full flex-col p-4 ${className}`}
      style={style}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={endPress}
      onPointerLeave={() => {
        endPress();
        setShowTooltip(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* header: index + icon */}
      <div className="flex items-start justify-between">
        <span className="mono text-[0.7rem] tracking-widest text-muted">
          {index}
        </span>
        <span className="text-muted-strong">{icon}</span>
      </div>

      {/* body / mini-viz */}
      <div className="flex flex-1 items-center">{children}</div>

      {/* footer: label + sublabel + arrow */}
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className={
              feature
                ? "serif-italic text-lg uppercase tracking-wide text-muted-strong md:text-xl"
                : "serif-italic text-xs uppercase tracking-wider text-muted"
            }
          >
            {label}
          </span>
          {!feature && subLabel != null && (
            <span className="text-[0.7rem] font-medium">{subLabel}</span>
          )}
        </div>
        <span className="text-muted transition-colors">
          <ArrowIcon size={16} />
        </span>
      </div>

      {summary && showTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-md border border-border-strong bg-bg-elevated/95 px-3 py-2 text-[0.72rem] text-muted-strong shadow-glass backdrop-blur"
        >
          {summary}
        </div>
      )}
    </div>
  );
}
