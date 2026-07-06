"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Shared bottom sheet for the /vitals tab, styled to match the training
 * HistorySheet: dimmed backdrop, rounded top panel pinned to the bottom, a grab
 * handle, and an Escape-to-close affordance. Callers supply the body.
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative flex w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
        role="dialog"
        aria-label={title}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden
        />
        <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}
