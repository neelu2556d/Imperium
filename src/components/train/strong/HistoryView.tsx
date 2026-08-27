"use client";

import { useEffect, useState } from "react";
import { fetchHistory, type HistoryEntry } from "@/lib/supabase/workouts";
import { formatDuration, getTrainSettings, kgToDisplay } from "@/lib/train/settings";

/** History sub-tab: finished sessions, newest first. */
export default function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const unit = getTrainSettings().unit;

  useEffect(() => {
    fetchHistory().then((e) => {
      setEntries(e);
      setReady(true);
    });
  }, []);

  if (ready && entries.length === 0) {
    return <p className="text-[0.85rem] text-muted">No finished workouts yet. Your history will show here.</p>;
  }

  return (
    <div className="flex flex-col gap-3" style={{ opacity: ready ? 1 : 0.6, transition: "opacity 200ms" }}>
      {entries.map((e) => {
        const date = new Date(e.started_at).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const vol = Math.round(kgToDisplay(e.total_volume_kg, unit));
        return (
          <section
            key={e.id}
            className="rounded-2xl border p-4"
            data-no-vitality
            style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="serif-italic text-lg" data-no-vitality>
                {e.name}
              </h2>
              <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">{date}</span>
            </div>
            <div className="mono mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-muted-strong">
              <span>
                {formatDuration(e.duration_seconds ?? 0)}
                <span className="text-muted"> time</span>
              </span>
              <span>
                {vol.toLocaleString()} {unit}
                <span className="text-muted"> volume</span>
              </span>
              <span>
                {e.setCount}
                <span className="text-muted"> sets</span>
              </span>
              <span>
                {e.exerciseCount}
                <span className="text-muted"> exercises</span>
              </span>
            </div>
            {e.notes && <p className="mt-2 text-[0.78rem] text-muted">{e.notes}</p>}
          </section>
        );
      })}
    </div>
  );
}
