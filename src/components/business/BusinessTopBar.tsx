"use client";

import { useEffect, useState } from "react";
import { GearIcon } from "@/components/train/icons";
import { formatToday } from "@/lib/home/datetime";

/**
 * The Business tab's top bar: an editorial "Business" heading, today's date in
 * mono small-caps, and a settings gear (inert for now — business-specific
 * settings land later). The date is seeded on the server then corrected on
 * mount so it reflects the user's local wall clock (hence suppressHydrationWarning).
 */
export default function BusinessTopBar() {
  const [today, setToday] = useState(() => new Date());
  // Correct to the client's local wall clock just after mount (SSR renders in
  // the server timezone). Done in a timer callback, not synchronously in the
  // effect body, to avoid a cascading re-render on first paint.
  useEffect(() => {
    const id = setTimeout(() => setToday(new Date()), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <header className="flex items-center gap-4 px-5 pt-8 md:px-8 lg:px-12">
      <div className="min-w-0 flex-1">
        <h1 className="serif-italic text-3xl leading-tight md:text-4xl" data-no-vitality>
          Business
        </h1>
        <p
          className="mono mt-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-muted"
          suppressHydrationWarning
        >
          {formatToday(today)}
        </p>
      </div>

      <button
        type="button"
        data-no-vitality
        aria-label="Business settings"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-mint hover:text-fg"
      >
        <GearIcon size={17} />
      </button>
    </header>
  );
}
