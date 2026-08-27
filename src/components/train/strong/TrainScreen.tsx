"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GearIcon } from "@/components/train/icons";
import DashboardView from "@/components/train/strong/DashboardView";
import HistoryView from "@/components/train/strong/HistoryView";
import ProgressView from "@/components/train/strong/ProgressView";
import { seedDefaultRoutines } from "@/lib/supabase/workouts";

type Tab = "dashboard" | "history" | "progress";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "history", label: "History" },
  { key: "progress", label: "Progress" },
];

/**
 * The Train tab shell — a Strong-style workout tracker. A pill sub-nav switches
 * between Dashboard (routines + start a workout), History (past sessions) and
 * Progress (PRs, per-exercise charts, measurements). Seeds the three starter
 * routines the first time a user with none opens the tab.
 */
export default function TrainScreen() {
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    seedDefaultRoutines().catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="flex items-center justify-between">
        <h1 className="serif-italic text-4xl leading-tight" data-no-vitality>
          Train
        </h1>
        <Link
          href="/train/settings"
          aria-label="Train settings"
          data-no-vitality
          className="flex h-10 w-10 items-center justify-center rounded-full border text-muted"
          style={{ borderColor: "var(--color-border-strong)", background: "var(--color-card-elevated)" }}
        >
          <GearIcon size={18} />
        </Link>
      </header>

      <nav className="mt-5 flex gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              data-no-vitality
              className="flex-1 rounded-full px-3 py-2 text-[0.8rem] font-medium"
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                background: active ? "var(--accent)" : "var(--color-card-elevated)",
                color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === "dashboard" && <DashboardView />}
        {tab === "history" && <HistoryView />}
        {tab === "progress" && <ProgressView />}
      </div>
    </div>
  );
}
