"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface VitalityTileProps {
  /** Grid-area class, e.g. "area-train". */
  area: string;
  /** Accent variant class, e.g. "tile-train" | "tile-vitals" | "tile-fuel" | "tile-brand". */
  variant: string;
  /** Two-digit mono index shown top-left, e.g. "01". */
  index: string;
  /** Small mint glyph shown top-right. */
  glyph: ReactNode;
  /** Serif-italic label shown bottom-left, e.g. "Train". */
  label: string;
  /** Mono stat above the label; `unit` renders as a small-caps suffix. */
  stat?: ReactNode;
  unit?: string;
  /** Extra classes merged onto the tile shell (e.g. the entrance animation). */
  className?: string;
  /** Inline style merged onto the tile shell (e.g. the stagger delay). */
  style?: CSSProperties;
  /** The animated art layer filling the tile. */
  art: ReactNode;
  /** Route to open on tap. */
  href: string;
  ariaLabel: string;
  /** One-line summary revealed on long-press. */
  summary?: string;
  /** Adds `is-warn` to recolour the accent (e.g. sleep below goal). */
  warn?: boolean;
}

const LONG_PRESS_MS = 400;

/**
 * A single "Vitality" bento tile: dark glass shell, animated art layer, and
 * mono/serif text chrome (index · glyph · stat · label · arrow). The whole tile
 * navigates to `href`; a 400ms long-press instead reveals the summary popover
 * and suppresses navigation. Keyboard accessible via role="button".
 */
export default function VitalityTile({
  area,
  variant,
  index,
  glyph,
  label,
  stat,
  unit,
  art,
  href,
  ariaLabel,
  summary,
  warn = false,
  className = "",
  style,
}: VitalityTileProps) {
  const router = useRouter();
  const [showSummary, setShowSummary] = useState(false);
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
      setShowSummary(true);
    }, LONG_PRESS_MS);
  };

  const navigate = () => {
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
      className={`vee-tile ${area} ${variant} ${warn ? "is-warn" : ""} ${className}`}
      style={style}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={() => {
        clearTimer();
        setShowSummary(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="vee-aurora" />
      <div className="vee-art">{art}</div>

      <span className="vee-index">{index}</span>
      <span className="vee-glyph">{glyph}</span>

      {stat && (
        <div className="vee-stat">
          {stat}
          {unit && <i>{unit}</i>}
        </div>
      )}

      <div className="vee-label">{label}</div>

      <svg
        className="vee-arrow"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>

      {summary && showSummary && (
        <div role="tooltip" className="vee-summary">
          {summary}
        </div>
      )}
    </div>
  );
}
