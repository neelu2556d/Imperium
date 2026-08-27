"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/toast";
import { PlusIcon, TrashIcon } from "@/components/train/icons";
import {
  discardSession,
  fetchActiveSession,
  fetchRoutines,
  startSession,
  type Routine,
  type WorkoutSession,
} from "@/lib/supabase/workouts";

/** Dashboard sub-tab: resume/active banner, routine list, start a workout. */
export default function DashboardView() {
  const router = useRouter();
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = () =>
    Promise.all([fetchActiveSession(), fetchRoutines()]).then(([a, r]) => {
      setActive(a);
      setRoutines(r);
      setReady(true);
    });

  useEffect(() => {
    load();
  }, []);

  const start = async (routine: Routine | null) => {
    if (starting) return;
    setStarting(true);
    try {
      const id = await startSession({
        routineId: routine?.id ?? null,
        name: routine?.name ?? "Empty workout",
      });
      router.push(`/train/workout/${id}`);
    } catch {
      pushToast("Couldn't start that workout.");
      setStarting(false);
    }
  };

  const discard = async () => {
    if (!active) return;
    const prev = active;
    setActive(null);
    try {
      await discardSession(prev.id);
      pushToast("Workout discarded");
    } catch {
      setActive(prev);
      pushToast("Couldn't discard that workout.");
    }
  };

  return (
    <div className="flex flex-col gap-4" style={{ opacity: ready ? 1 : 0.6, transition: "opacity 200ms" }}>
      {active && (
        <section
          className="sticky top-2 z-20 rounded-2xl border p-4"
          data-no-vitality
          style={{ borderColor: "var(--accent)", background: "rgb(var(--accent-rgb) / 0.08)" }}
        >
          <p className="mono text-[0.6rem] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            Workout in progress
          </p>
          <p className="serif-italic mt-1 text-xl" data-no-vitality>
            {active.name}
          </p>
          <div className="mt-3 flex gap-2">
            <Link href={`/train/workout/${active.id}`} className="btn-primary flex-1 text-center text-[0.85rem]">
              Resume →
            </Link>
            <button
              type="button"
              onClick={discard}
              aria-label="Discard workout"
              data-no-vitality
              className="flex items-center justify-center rounded-full border px-3"
              style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--danger)" }}
            >
              <TrashIcon size={18} />
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => start(null)}
        disabled={starting}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        <PlusIcon size={16} /> Start empty workout
      </button>

      <div className="flex items-center justify-between">
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Routines</p>
        <Link href="/train/routine/new" className="link text-[0.75rem]" data-no-vitality>
          + New
        </Link>
      </div>

      {ready && routines.length === 0 && (
        <p className="text-[0.85rem] text-muted">No routines yet. Create one to get started.</p>
      )}

      <div className="flex flex-col gap-3">
        {routines.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border p-4"
            data-no-vitality
            style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <Link href={`/train/routine/${r.id}`} className="min-w-0 flex-1" data-no-vitality>
                <span className="serif-italic block truncate text-lg" data-no-vitality>
                  {r.name}
                </span>
                {r.notes && <span className="block truncate text-[0.78rem] text-muted">{r.notes}</span>}
              </Link>
              <button
                type="button"
                onClick={() => start(r)}
                disabled={starting}
                className="shrink-0 rounded-full px-4 py-2 text-[0.8rem] font-medium"
                style={{ border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Start
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
