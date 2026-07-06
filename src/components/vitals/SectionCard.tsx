import type { ReactNode } from "react";

/**
 * The glass card shell each /vitals section sits in: an icon + serif title on
 * the left of the header, an optional node (date, edit link) on the right, then
 * the section body below.
 */
export default function SectionCard({
  icon,
  title,
  right,
  children,
}: {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5"
      data-no-vitality
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span style={{ color: "var(--color-mint)" }}>{icon}</span>
          <h2 className="serif-italic text-2xl" data-no-vitality>
            {title}
          </h2>
        </div>
        {right && <div className="flex items-center gap-3">{right}</div>}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
