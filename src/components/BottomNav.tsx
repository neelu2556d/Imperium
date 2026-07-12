"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  DumbbellIcon,
  FlameIcon,
  GemIcon,
  HouseIcon,
  WaterDropIcon,
} from "@/components/home/icons";

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

export default function BottomNav() {
  const pathname = usePathname();

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

  const activeIndex = TABS.findIndex(({ href }) => pathname.startsWith(href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/70 backdrop-blur-lg">
      <ul className="relative flex">
        {/* mint indicator that slides horizontally to the active tab */}
        {activeIndex >= 0 && (
          <li
            aria-hidden
            className="vt-nav-indicator pointer-events-none absolute top-0 h-0.5"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
              background: "var(--color-mint)",
              boxShadow: "0 0 8px var(--color-mint-glow)",
            }}
          />
        )}
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors"
                style={{
                  color: isActive
                    ? "var(--color-mint)"
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
