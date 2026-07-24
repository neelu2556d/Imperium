"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BriefcaseIcon,
  DumbbellIcon,
  FlameIcon,
  GemIcon,
  HouseIcon,
  WaterDropIcon,
} from "@/components/home/icons";
import { useOwner } from "@/lib/useOwner";

interface Tab {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}

const TABS: Tab[] = [
  { href: "/home", label: "Home", Icon: HouseIcon },
  { href: "/train", label: "Train", Icon: DumbbellIcon },
  { href: "/vitals", label: "Vitals", Icon: WaterDropIcon },
  { href: "/fuel", label: "Fuel", Icon: FlameIcon },
  { href: "/mentor", label: "Imperium", Icon: GemIcon },
];

// The Business tab is owner-only; appended to the base tabs when `useOwner()`
// resolves true (see lib/owner.ts). The server-side proxy guard is the hard
// gate — this just controls whether the entry point renders.
const BUSINESS_TAB: Tab = {
  href: "/business",
  label: "Business",
  Icon: BriefcaseIcon,
};

export default function BottomNav() {
  const pathname = usePathname();
  const isOwner = useOwner();

  // Pre-app flows (auth, welcome, onboarding) are entered before the tabs are
  // meaningful — their nav targets are gated, and showing a tab bar with no
  // active tab would only tempt users out of the flow. Hide it on all of them.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/onboarding")
  ) {
    return null;
  }

  const tabs = isOwner ? [...TABS, BUSINESS_TAB] : TABS;
  const activeIndex = tabs.findIndex(({ href }) => pathname.startsWith(href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/70 backdrop-blur-lg"
        style={{ transform: 'translateZ(0)' }}>
      <ul className="relative flex">
        {/* mint indicator that slides horizontally to the active tab */}
        {activeIndex >= 0 && (
          <li
            aria-hidden
            className="vt-nav-indicator pointer-events-none absolute top-0 h-0.5"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent-glow)",
            }}
          />
        )}
        {tabs.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors"
                style={{
                  color: isActive
                    ? "var(--accent)"
                    : "var(--color-muted)",
                }}
              >
                {/* remount on activation so the bounce replays each tab switch */}
                <span
                  key={isActive ? "on" : "off"}
                  className={isActive ? "vt-nav-bounce" : undefined}
                  style={{ display: "inline-flex" }}
                >
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
