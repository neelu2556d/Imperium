"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  dismissToast,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type Toast,
} from "@/lib/toast";

interface RenderedToast extends Toast {
  /** True once the toast has left the store — kept mounted to play the exit. */
  leaving: boolean;
}

/** Must match vtToastOut in globals.css. */
const EXIT_MS = 200;

/**
 * Renders the non-blocking toast stack: dark glass pills with a mint left
 * border, pinned bottom-centre above the tab bar. Fed by the module-level store
 * in `lib/toast`.
 *
 * Motion: each toast rises in from below (200ms), carries a thin mint progress
 * bar that depletes over its 3s life, then slides back out. Because the store
 * removes a toast the instant it expires, this component keeps departing toasts
 * mounted for one exit beat so the slide-out is visible. All of it collapses
 * under prefers-reduced-motion via the CSS classes.
 */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [rendered, setRendered] = useState<RenderedToast[]>([]);
  const [seenToasts, setSeenToasts] = useState(toasts);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // Reconcile the live store list against what's on screen — done during render
  // (React's supported "adjust state when an input changes" pattern) rather than
  // in an effect. Newcomers are added; anything the store dropped is marked
  // `leaving` so its exit animation plays before it's actually removed.
  if (toasts !== seenToasts) {
    setSeenToasts(toasts);
    const live = new Set(toasts.map((t) => t.id));
    setRendered((prev) => {
      const next: RenderedToast[] = prev.map((r) =>
        live.has(r.id) || r.leaving ? r : { ...r, leaving: true }
      );
      for (const t of toasts) {
        if (!next.some((r) => r.id === t.id)) {
          next.push({ ...t, leaving: false });
        }
      }
      return next;
    });
  }

  // Once a toast is marked leaving, schedule its real removal after the exit
  // animation. Kept separate from reconciliation so no timer is set inside a
  // state updater.
  useEffect(() => {
    for (const r of rendered) {
      if (r.leaving && !timers.current.has(r.id)) {
        const id = setTimeout(() => {
          timers.current.delete(r.id);
          setRendered((cur) => cur.filter((x) => x.id !== r.id));
        }, EXIT_MS);
        timers.current.set(r.id, id);
      }
    }
  }, [rendered]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const id of map.values()) clearTimeout(id);
      map.clear();
    };
  }, []);

  if (rendered.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[9998] flex flex-col items-center gap-2 px-4"
    >
      {rendered.map((t) => (
        <button
          key={t.id}
          type="button"
          data-no-vitality
          onClick={() => dismissToast(t.id)}
          role="status"
          className={`pointer-events-auto relative flex max-w-sm items-center gap-2 overflow-hidden rounded-pill py-2.5 pl-3.5 pr-4 text-left text-[0.8rem] leading-snug text-fg ${
            t.leaving ? "vt-toast-out" : "vt-toast-in"
          }`}
          style={{
            borderLeft: "3px solid var(--color-mint)",
            background: "rgba(10, 10, 10, 0.72)",
            WebkitBackdropFilter: "blur(16px) saturate(1.3)",
            backdropFilter: "blur(16px) saturate(1.3)",
            boxShadow: "var(--shadow-glass)",
          }}
        >
          <span>{t.message}</span>
          {/* time-remaining bar: depletes left→right over the toast's 3s life */}
          {!t.leaving && (
            <span
              aria-hidden
              className="vt-toast-bar absolute bottom-0 left-0 h-0.5 w-full"
              style={{ background: "var(--color-mint)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
