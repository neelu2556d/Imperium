"use client";

import { useCountUp } from "@/lib/motion";

interface CountUpProps {
  /** The real, final value. Counts 0 → value on mount (600ms easeOutExpo). */
  value: number;
  /** Decimal places to show. Default 0. */
  decimals?: number;
  /** Rendered before/after the number (units, symbols). Not animated. */
  prefix?: string;
  suffix?: string;
  /**
   * Custom number → string formatter. Overrides `decimals`. Lets a caller keep
   * an exact resting format (e.g. trimming trailing zeros) while still
   * animating the value.
   */
  format?: (n: number) => string;
  /**
   * Hold at 0 until the real data is ready, then count up once. Pass the load
   * flag so the tween fires when the number actually arrives, not on the
   * placeholder 0.
   */
  restartKey?: unknown;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single live number that counts up from 0 to its real value on mount, per
 * the app's motion spec (600ms, easeOutExpo, requestAnimationFrame — no
 * library). Only the digits animate; any prefix/suffix (units, "kg", "/") is
 * static. Honours prefers-reduced-motion via {@link useCountUp}, which snaps
 * straight to the final value.
 *
 * Intended to wrap JetBrains-Mono numeric stats — labels stay untouched.
 */
export default function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  restartKey,
  duration,
  format,
  className,
  style,
}: CountUpProps) {
  const live = useCountUp(value, { duration, restartKey });
  const shown = format
    ? format(live)
    : decimals > 0
      ? live.toFixed(decimals)
      : String(Math.round(live));

  return (
    <span className={className} style={style}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
