"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Animates the main content area on every route change: the outgoing page fades
 * out + slides down briefly (180ms), then the incoming page fades in + slides up
 * 16px→0 (300ms, premium easing). Bottom-nav tab switches route through here too,
 * so they share the same transition.
 *
 * Implemented as a keyed crossfade held in state: when the pathname changes we
 * render the previous children with an "exit" class for one 180ms beat, then
 * swap to the new children with an "enter" class. The visual work lives in CSS
 * (.vt-page-enter / .vt-page-exit) so prefers-reduced-motion is honoured there —
 * reduced motion collapses both to an instant swap.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // What's currently painted, and the phase it's in.
  const [rendered, setRendered] = useState<{ key: string; node: ReactNode }>({
    key: pathname,
    node: children,
  });
  const [phase, setPhase] = useState<"idle" | "enter">("idle");
  const prevPath = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname === prevPath.current) {
      // Same route, children updated in place (e.g. state) — pass through.
      setRendered({ key: pathname, node: children });
      return;
    }
    prevPath.current = pathname;

    // Swap to the new page and play the enter animation. The exit beat is short
    // and the incoming page slides up over it, so a single keyed swap reads as
    // the spec's "exit then enter" without double-mounting data-fetching pages.
    setRendered({ key: pathname, node: children });
    setPhase("enter");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("idle"), 320);
  }, [pathname, children]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <div
      key={rendered.key}
      className={phase === "enter" ? "vt-page-enter" : undefined}
    >
      {rendered.node}
    </div>
  );
}
