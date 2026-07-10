"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/train/session/icons";
import {
  fetchSessionHistory,
  type SessionHistoryEntry,
} from "@/lib/supabase/train";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; sessions: SessionHistoryEntry[] };

const MINT = "var(--color-mint)";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** "WED, JUL 8" from a local YYYY-MM-DD (parsed part-wise to avoid UTC shift). */
function formatSessionDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The full training-history log, reachable from the "Last session" card on the
 * /train dashboard. One card per past session, newest first, each showing the
 * day it maps to, its set count, and a per-exercise breakdown. A thin frame in
 * the same shape as <ProgressScreen>.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchSessionHistory().then((sessions) => {
      if (!cancelled) setState({ status: "ready", sessions });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = state.status === "ready" ? state.sessions : [];

  return (
    <div className="w-full px-5 pb-28 pt-8 md:px-8 lg:px-12">
      <button
        type="button"
        onClick={() => router.back()}
        data-no-vitality
        className="mono inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[0.7rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
      >
        <BackIcon size={15} /> Back
      </button>

      <header className="mt-3">
        <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          Training log
        </p>
        <h1 className="serif-italic mt-1 text-4xl leading-tight" data-no-vitality>
          Session history
        </h1>
      </header>

      {state.status === "loading" ? (
        <div className="mt-8 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="home-skeleton h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card mt-8 p-6" data-no-vitality>
          <p className="serif-italic text-xl" data-no-vitality>
            No sessions yet
          </p>
          <p className="mt-2 text-sm text-muted">
            Log a session from the Train tab and it&apos;ll show up here.
          </p>
          <Link href="/train" className="btn-primary mt-4" data-no-vitality>
            Back to Train →
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {sessions.map((s) => (
            <article key={s.date} className="card p-5" data-no-vitality>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h2 className="serif-italic text-2xl leading-tight" data-no-vitality>
                      {s.dayName ?? "Session"}
                    </h2>
                    <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                      {formatSessionDate(s.date)}
                    </span>
                  </div>
                  {s.topLift && (
                    <p className="mt-1 truncate text-sm text-muted-strong">
                      Top: {s.topLift.name}
                      <span className="mono" style={{ color: MINT }}>
                        {" — "}
                        {s.topLift.weight}kg × {s.topLift.reps}
                      </span>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="serif-italic text-2xl" data-no-vitality style={{ color: MINT }}>
                    {s.totalSets}
                  </div>
                  <div className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                    Sets
                  </div>
                </div>
              </div>

              {s.exercises.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  {s.exercises.map((ex, i) => {
                    const row = (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-fg">{ex.name}</span>
                        <span className="mono shrink-0 text-[0.68rem] text-muted-strong">
                          {ex.sets} {ex.sets === 1 ? "set" : "sets"}
                          {ex.topWeight != null && (
                            <span style={{ color: MINT }}>
                              {" · "}
                              {ex.topWeight}kg
                              {ex.topReps != null && ` × ${ex.topReps}`}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                    return (
                      <li key={`${ex.exerciseId ?? "x"}-${i}`}>
                        {ex.exerciseId ? (
                          <Link
                            href={`/train/progress/${ex.exerciseId}`}
                            data-no-vitality
                            className="block rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--color-card-hover,rgba(255,255,255,0.03))]"
                          >
                            {row}
                          </Link>
                        ) : (
                          <div className="px-1 py-0.5">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
