"use client";

import { useSyncExternalStore } from "react";
import {
  dismissToast,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/toast";

/**
 * Renders the non-blocking toast stack: dark glass pills with a mint left
 * border, pinned bottom-centre above the tab bar. Fed by the module-level
 * store in `lib/toast` so the Supabase data layer can raise a toast on a failed
 * query without a React context — a dropped read or failed write tells the user
 * instead of silently emptying the page or crashing it.
 */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[9998] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          data-no-vitality
          onClick={() => dismissToast(t.id)}
          role="status"
          className="vt-rise-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-pill py-2.5 pl-3.5 pr-4 text-left text-[0.8rem] leading-snug text-fg"
          style={{
            borderLeft: "3px solid var(--color-mint)",
            background: "rgba(10, 10, 10, 0.72)",
            WebkitBackdropFilter: "blur(16px) saturate(1.3)",
            backdropFilter: "blur(16px) saturate(1.3)",
            boxShadow: "var(--shadow-glass)",
          }}
        >
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
