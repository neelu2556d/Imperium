"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DayCard from "@/components/train/DayCard";
import { RefreshIcon, TrashIcon } from "@/components/train/icons";
import { formatToday } from "@/lib/home/datetime";
import { todayIndexInSplit } from "@/lib/train/schedule";
import {
  deleteSession,
  fetchFirstSessionDate,
  fetchLastSession,
  fetchSplitDays,
  type LastSession,
  type TrainSplitDay,
} from "@/lib/supabase/train";
import { pushToast } from "@/lib/toast";

interface TrainData {
  /** First-ever logged session date — the anchor the split cycles from. */
  firstSession: Date | null;
  days: TrainSplitDay[];
  lastSession: LastSession | null;
}

type LoadState = { status: "loading" } | { status: "ready"; data: TrainData };

const MINT = "var(--color-mint)";

/** Compact "MON, JUN 3" label for the last-session summary. */
function formatSessionDate(iso: string): string {
  // iso is a local YYYY-MM-DD; parse the parts to avoid UTC shifting the day.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

export default function TrainDashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Which split day the user has chosen to train today. `null` means "follow
  // the schedule" — we fall back to the auto-cycled day below.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Two-tap delete for the last-session card: first tap arms, second confirms.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Bumped after a delete so the effect refetches (the next-newest session
  // becomes the new "last session").
  const [reloadKey, setReloadKey] = useState(0);

  // The date sub-header reflects the user's wall clock; the server renders its
  // own timezone and the client corrects on hydration (suppressed below).
  const dateStr = formatToday(new Date());

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchFirstSessionDate(),
      fetchSplitDays(),
      fetchLastSession(),
    ]).then(([firstSession, days, lastSession]) => {
      if (cancelled) return;
      setState({ status: "ready", data: { firstSession, days, lastSession } });
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleDeleteLastSession = async (date: string) => {
    if (deleting) return;
    setDeleting(true);
    const ok = await deleteSession(date);
    setDeleting(false);
    setConfirmingDelete(false);
    if (ok) {
      pushToast("Session deleted");
      setState({ status: "loading" });
      setReloadKey((k) => k + 1);
    }
  };

  const loading = state.status === "loading";
  const data = state.status === "ready" ? state.data : null;
  const days = data?.days ?? [];

  // Cycle through the split from the first logged session. With nothing logged
  // yet (firstSession null) we default to day 1 (index 0) rather than anchoring
  // on an arbitrary date.
  const scheduledIndex =
    days.length === 0
      ? -1
      : data?.firstSession
        ? todayIndexInSplit(data.firstSession, new Date(), days.length)
        : 0;

  // The user's free pick wins; otherwise we highlight the scheduled day.
  const activeIndex =
    selectedIndex !== null && selectedIndex < days.length
      ? selectedIndex
      : scheduledIndex;

  return (
    <div className="w-full px-5 pb-28 pt-8 md:px-8 lg:px-12">
      {/* ---------- top bar ---------- */}
      <header className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="serif-italic text-3xl leading-tight md:text-4xl" data-no-vitality>
            Today&apos;s session
          </h1>
          <p
            className="mono mt-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-muted"
            suppressHydrationWarning
          >
            {dateStr}
          </p>
          {!loading && days.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Tap a training day to open it and start logging.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/onboarding/customize-days"
            data-no-vitality
            className="mono inline-flex items-center gap-1.5 rounded-pill border border-border-strong px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-muted-strong transition-colors hover:border-mint hover:text-fg"
          >
            <RefreshIcon size={13} />
            <span className="hidden sm:inline">Adjust your training</span>
            <span className="sm:hidden">Adjust</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* ---------- split day-cards ---------- */}
      {loading ? (
        <SplitSkeleton />
      ) : days.length === 0 ? (
        <EmptySplit />
      ) : (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {days.map((day, i) => (
            <DayCard
              key={day.id}
              index={i + 1}
              day={day}
              isActive={i === activeIndex}
              isScheduled={i === scheduledIndex}
              onSelect={() => setSelectedIndex(i)}
            />
          ))}
        </div>
      )}

      {/* ---------- last session ---------- */}
      <section
        className="mt-8 rounded-lg border-0 p-0"
        data-no-vitality
        aria-label="Last session"
      >
        <h2
          className="mono mb-3 text-[0.65rem] uppercase tracking-[0.2em] text-muted"
          data-no-vitality
        >
          Last session
        </h2>
        {loading ? (
          <div className="home-skeleton h-20 w-full rounded-lg" />
        ) : data?.lastSession ? (
          <Link
            href="/train/history"
            data-no-vitality
            className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-mint"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="serif-italic text-xl" data-no-vitality>
                  {data.lastSession.dayName ?? "Session"}
                </span>
                <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                  {formatSessionDate(data.lastSession.date)}
                </span>
              </div>
              {data.lastSession.topLift && (
                <p className="mt-1 truncate text-sm text-muted-strong">
                  {data.lastSession.topLift.name}
                  <span className="mono" style={{ color: MINT }}>
                    {" — "}
                    {data.lastSession.topLift.weight}kg ×{" "}
                    {data.lastSession.topLift.reps}
                  </span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="serif-italic text-2xl" data-no-vitality style={{ color: MINT }}>
                  {data.lastSession.totalSets}
                </div>
                <div className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                  Sets logged
                </div>
              </div>
              <button
                type="button"
                data-no-vitality
                aria-label={
                  confirmingDelete
                    ? "Confirm delete last session"
                    : "Delete last session"
                }
                disabled={deleting}
                onClick={(e) => {
                  // The button lives inside the history Link — don't navigate.
                  e.preventDefault();
                  e.stopPropagation();
                  if (!confirmingDelete) {
                    setConfirmingDelete(true);
                    return;
                  }
                  void handleDeleteLastSession(data.lastSession!.date);
                }}
                className="mono flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] transition-colors"
                style={{
                  borderColor: confirmingDelete
                    ? "var(--color-red)"
                    : "var(--color-border-strong)",
                  color: confirmingDelete ? "var(--color-red)" : "var(--color-muted)",
                  background: "transparent",
                }}
              >
                <TrashIcon size={13} />
                {confirmingDelete && (deleting ? "…" : "Sure?")}
              </button>
            </div>
          </Link>
        ) : (
          <div className="card p-4 text-sm text-muted" data-no-vitality>
            No sessions logged yet — your first one will show up here.
          </div>
        )}
      </section>

    </div>
  );
}

/** Shimmer placeholders shaped like the split row while it loads. */
function SplitSkeleton() {
  return (
    <div className="-mx-5 flex gap-3 overflow-hidden px-5 md:mx-0 md:px-0">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="home-skeleton w-40 shrink-0 rounded-lg"
          style={{ height: 200 }}
        />
      ))}
    </div>
  );
}

/** Shown when the user hasn't built a split yet. */
function EmptySplit() {
  return (
    <div className="card flex flex-col items-start gap-3 p-6" data-no-vitality>
      <p className="serif-italic text-xl" data-no-vitality>
        No split yet
      </p>
      <p className="text-sm text-muted">
        Set up your training days and we&apos;ll cycle through them here every day.
      </p>
      <Link href="/onboarding/customize-days" className="btn-primary" data-no-vitality>
        Build your split →
      </Link>
    </div>
  );
}
