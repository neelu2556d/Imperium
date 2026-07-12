"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "@/lib/motion";

/** Fraction of the sheet's height a downward drag must pass to dismiss it. */
const DISMISS_FRACTION = 0.4;
/** Must match the vtSheetOut duration in globals.css. */
const EXIT_MS = 300;

export interface SheetControls {
  /** Add to the backdrop element (fade in/out). */
  backdropClassName: string;
  /** Add to the sliding panel element (slide up/down). */
  panelClassName: string;
  /** Ref for the panel — used to measure height for the drag threshold. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Live drag transform for the panel (identity when not dragging). */
  panelStyle: CSSProperties;
  /** Spread onto the grab handle so a downward drag dismisses the sheet. */
  handleProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
  /** Merge into the grab handle's own style (touch-action + grab cursor). */
  handleStyle: CSSProperties;
  /** Animate the sheet out, then invoke the caller's onClose. */
  close: () => void;
}

/**
 * Drives the shared bottom-sheet motion: a slide-up entrance, a slide-down exit
 * that plays *before* the sheet unmounts, and drag-to-dismiss from the grab
 * handle (release past 40% of the sheet height to close, otherwise snap back).
 *
 * Callers render normally and route every dismissal — backdrop tap, Escape,
 * cancel buttons — through the returned `close()` so the exit always animates.
 * Honours prefers-reduced-motion: the exit collapses to an instant unmount and
 * dragging is disabled.
 */
export function useSheet(onClose: () => void): SheetControls {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    []
  );

  const close = useCallback(() => {
    if (closing) return;
    if (reduced) {
      onClose();
      return;
    }
    setClosing(true);
    exitTimer.current = setTimeout(onClose, EXIT_MS);
  }, [closing, reduced, onClose]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (reduced || closing) return;
    dragging.current = true;
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    // Only track downward drags; ignore upward pull.
    setDragY(Math.max(0, e.clientY - startY.current));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const height = panelRef.current?.offsetHeight ?? 0;
    if (height > 0 && dragY > height * DISMISS_FRACTION) {
      close();
    } else {
      setDragY(0); // snap back
    }
  };

  // Derived purely from `dragY` (state), so nothing reads a ref during render:
  // while a finger is down dragY>0 and the panel tracks it with no transition;
  // on release dragY returns to 0 and the panel eases back / rests.
  const panelStyle: CSSProperties =
    dragY > 0
      ? { transform: `translateY(${dragY}px)`, transition: "none" }
      : { transition: "transform 220ms var(--ease-premium)" };

  return {
    backdropClassName: `vt-sheet-backdrop ${closing ? "vt-closing" : ""}`,
    panelClassName: `vt-sheet-panel ${closing ? "vt-closing" : ""}`,
    panelRef,
    panelStyle,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    handleStyle: { touchAction: "none", cursor: "grab" },
    close,
  };
}
