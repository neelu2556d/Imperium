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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/70 backdrop-blur-lg">
      <ul className="flex">
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
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
