"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sparkline from "@/components/home/Sparkline";
import { fetchExerciseHistory, type HistoryEntry } from "@/lib/supabase/session";
import { formatWeight } from "@/lib/train/overload";

interface HistorySheetProps {
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}

/** Compact "MON, JUN 3" label from a local YYYY-MM-DD (no UTC day shift). */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Bottom sheet of an exercise's full logged history, newest first: each session
 * as its date and set list, topped by a sparkline of top-set weight over time so
 * the progression reads at a glance.
 */
export default function HistorySheet({
  exerciseId,
  exerciseName,
  onClose,
}: HistorySheetProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExerciseHistory(exerciseId).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // Sparkline wants oldest → newest; history comes newest first.
  const series =
    entries && entries.length > 1
      ? [...entries].reverse().map((e) => e.topWeight)
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
        role="dialog"
        aria-label={`History for ${exerciseName}`}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden
        />

        <div className="flex shrink-0 items-end justify-between gap-3">
          <div>
            <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              History
            </p>
            <h3 className="serif-italic mt-1 text-2xl">{exerciseName}</h3>
          </div>
          {series.length > 1 && (
            <Sparkline values={series} width={120} height={40} />
          )}
        </div>

        <Link
          href={`/train/progress/${exerciseId}`}
          className="link mono mt-3 inline-flex shrink-0 items-center gap-1 self-start text-[0.7rem] uppercase tracking-[0.12em]"
        >
          View progress →
        </Link>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {entries === null ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No sets logged for this exercise yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <div
                  key={entry.date}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: "var(--color-border)",
                    background: "var(--color-card)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                      {formatDate(entry.date)}
                    </span>
                    <span className="mono text-[0.62rem] text-muted">
                      {entry.sets.length}{" "}
                      {entry.sets.length === 1 ? "set" : "sets"}
                    </span>
                  </div>
                  <div className="mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
                    {entry.sets.map((set, i) => (
                      <span key={i} style={{ color: "var(--color-mint)" }}>
                        {formatWeight(set.weight)}kg × {set.reps ?? "—"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
