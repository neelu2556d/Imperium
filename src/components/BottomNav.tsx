"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/train", label: "Train" },
  { href: "/vitals", label: "Vitals" },
  { href: "/fuel", label: "Fuel" },
  { href: "/imperium", label: "Imperium" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t">
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-center py-4 text-sm font-medium ${
                  isActive ? "font-bold" : ""
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
