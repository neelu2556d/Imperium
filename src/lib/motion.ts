"use client";

/**
 * Zero-dependency motion helpers, matching the app's existing CSS-token
 * animation system (see globals.css). These cover the JS-driven bits that CSS
 * can't express on its own — chiefly count-up numbers — while every purely
 * visual transition stays in CSS so it can honour prefers-reduced-motion there.
 *
 * Everything here also respects prefers-reduced-motion: `useReducedMotion`
 * reports it, and the hooks below snap straight to their final value when it's
 * on, so no number ever animates for a user who asked motion off.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** easeOutExpo — fast start, long glide to rest. Matches the spec for count-ups. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** easeOutCubic — used by the ring / gauge / water fill sweeps. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** easeInOutQuad — the draw-on curve for charts and sparklines. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Reactive prefers-reduced-motion, read through useSyncExternalStore so the
 * media query is the external source of truth (no setState-in-effect). SSR-safe:
 * the server snapshot is false, so the first client paint matches, then it
 * corrects and tracks live changes to the OS setting.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(REDUCED_QUERY).matches
        : false,
    () => false
  );
}

interface CountUpOptions {
  /** Animation length in ms. Default 600 (the spec's number duration). */
  duration?: number;
  /** Easing curve, t∈[0,1]→[0,1]. Default easeOutExpo. */
  easing?: (t: number) => number;
  /**
   * Restart the tween whenever this changes, in addition to `value`. Lets a
   * mount-gated caller (data still loading) hold at 0 and only count up once
   * the real number arrives.
   */
  restartKey?: unknown;
}

/**
 * Counts a displayed number up from 0 → `value` on mount (and re-tweens if
 * `value` changes), using requestAnimationFrame — no library. Returns the live
 * value to render. With prefers-reduced-motion, or on the server, it simply
 * returns `value` with no animation.
 */
export function useCountUp(value: number, options: CountUpOptions = {}): number {
  const { duration = 600, easing = easeOutExpo, restartKey } = options;
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  // Mirror the on-screen value in a ref so a re-triggered tween can start from
  // wherever it currently is (no snap back to 0), without making `display` an
  // effect dependency.
  const displayRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const set = useCallback((v: number) => {
    displayRef.current = v;
    setDisplay(v);
  }, []);

  useEffect(() => {
    // Reduced motion: never animates — the hook returns `value` directly below.
    if (reduced) return;

    const from = displayRef.current;
    const delta = value - from;

    // All setState happens inside a rAF callback (not synchronously in the
    // effect body), so instant and animated paths share one code path.
    if (duration <= 0) {
      rafRef.current = requestAnimationFrame(() => set(value));
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      set(from + delta * easing(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        set(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduced, duration, restartKey, easing, set]);

  return reduced ? value : display;
}

/** Total geometric length of an SVG path, for stroke-dashoffset draw-ons. */
export function pathLength(d: string): number {
  if (typeof document === "undefined") return 0;
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  return p.getTotalLength();
}
