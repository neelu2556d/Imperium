"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

interface Pill {
  href: string;
  label: string;
}

const PILLS: Pill[] = [
  { href: "/business", label: "Overview" },
  { href: "/business/lots", label: "Lots" },
  { href: "/business/orders", label: "Orders" },
  { href: "/business/sales", label: "Sales" },
  { href: "/business/stock", label: "Stock" },
  { href: "/business/collections", label: "Collections" },
  { href: "/business/parties", label: "Parties" },
  { href: "/business/reports", label: "Reports" },
  { href: "/business/imperium", label: "Imperium" },
];

/**
 * The Business tab's internal navigation: a horizontally scrollable pill bar
 * pinned below the top bar. Active pill is a solid accent fill with dark ink;
 * inactive pills are ghost-outlined in the accent. Sticky so it stays in view
 * as the sub-page scrolls.
 */
export default function BusinessPillNav() {
  const pathname = usePathname();

  // Overview owns both `/business` and `/business/overview`; everything else
  // matches by prefix so nested routes (e.g. a lot detail) keep their pill lit.
  const isActive = (href: string) =>
    href === "/business"
      ? pathname === "/business" || pathname === "/business/overview"
      : pathname.startsWith(href);

  const activeStyle: CSSProperties = {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    borderColor: "var(--accent)",
  };
  const inactiveStyle: CSSProperties = {
    background: "transparent",
    color: "var(--accent)",
    borderColor: "var(--accent)",
  };

  return (
    <nav className="sticky top-0 z-40 mt-4 border-b border-border bg-bg/70 backdrop-blur-lg">
      <ul className="flex gap-2 overflow-x-auto px-5 py-3 md:px-8 lg:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PILLS.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                data-no-vitality
                aria-current={active ? "page" : undefined}
                className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-[0.8rem] font-medium transition-colors"
                style={active ? activeStyle : inactiveStyle}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
