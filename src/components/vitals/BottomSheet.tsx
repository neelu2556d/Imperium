"use client";

import { useEffect, type ReactNode } from "react";
import { useSheet } from "@/lib/useSheet";

/**
 * Shared bottom sheet for the /vitals tab, styled to match the training
 * HistorySheet: dimmed backdrop, rounded top panel pinned to the bottom, a grab
 * handle, and an Escape-to-close affordance. Callers supply the body.
 *
 * Motion: slides up on enter, slides down on exit (played before unmount), and
 * supports drag-to-dismiss from the grab handle — all via {@link useSheet},
 * which also honours prefers-reduced-motion.
 */
export default function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const {
    backdropClassName,
    panelClassName,
    panelRef,
    panelStyle,
    handleProps,
    handleStyle,
    close,
  } = useSheet(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`relative flex w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8 ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label={title}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full"
          style={{
            background: "var(--color-border-strong)",
            ...handleStyle,
          }}
          aria-hidden
          {...handleProps}
        />
        <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}
