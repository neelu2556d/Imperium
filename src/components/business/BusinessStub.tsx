import type { ReactNode } from "react";

/**
 * Placeholder for the Business sub-pages that don't have their real screens yet
 * (Lots, Orders, Sales, Stock, Collections, Parties, Reports, Imperium). Keeps
 * the pill nav honest — every pill routes somewhere — while the data screens are
 * built out. Matches the editorial tone of the rest of the tab.
 */
export default function BusinessStub({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <section className="px-5 pb-24 pt-10 md:px-8 lg:px-12">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <p
          className="mono text-[0.7rem] uppercase tracking-[0.18em] text-muted"
          data-no-vitality
        >
          Coming soon
        </p>
        <h2
          className="serif-italic mt-3 text-2xl md:text-3xl"
          data-no-vitality
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </section>
  );
}
