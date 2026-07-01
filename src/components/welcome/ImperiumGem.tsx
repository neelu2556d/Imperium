import type { CSSProperties } from "react";

interface ImperiumGemProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Faceted mint gem mark for the welcome screen. Pure SVG so it stays crisp
 * at any size and can be recolored entirely through theme tokens.
 */
export default function ImperiumGem({ className = "", style }: ImperiumGemProps) {
  return (
    <div className={`vt-gem ${className}`} style={style} aria-hidden="true">
      <svg className="vt-gem-svg" viewBox="0 0 120 150" width="140" height="175">
        <polygon points="60,8 22,46 60,72" fill="var(--color-mint-soft)" />
        <polygon points="60,8 98,46 60,72" fill="var(--color-mint)" />
        <polygon points="22,46 32,112 60,72" fill="var(--color-mint-deep)" />
        <polygon points="98,46 88,112 60,72" fill="var(--color-mint-hover)" />
        <polygon points="32,112 60,132 60,72" fill="var(--color-mint)" />
        <polygon points="88,112 60,132 60,72" fill="var(--color-mint-deep)" />
        <polygon
          points="60,8 22,46 98,46"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
        />
      </svg>
      <svg className="vt-gem-chevron" viewBox="0 0 40 20" width="34" height="17">
        <polyline
          points="4,4 20,16 36,4"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
