"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import ExerciseCard, { type LoggedMap } from "@/components/train/session/ExerciseCard";
import SwapSheet, { type SwapScope } from "@/components/train/session/SwapSheet";
import AddExerciseSheet, { type AddScope } from "@/components/train/session/AddExerciseSheet";
import HistorySheet from "@/components/train/session/HistorySheet";
import { BackIcon, GearIcon, PlusIcon, StarIcon } from "@/components/train/session/icons";
import type { ExerciseHit } from "@/lib/supabase/exercises";
import {
  addSessionExercise,
  fetchSessionDay,
  fetchSessionExercises,
  finishSession,
  logSet,
  swapDayExercise,
  type SessionDay,
  type SessionExercise,
} from "@/lib/supabase/session";

/**
 * Blue palette the deload toggle swaps in. Overriding the --color-mint token
 * family on the screen wrapper recolours the whole subtree in one move: every
 * child reads these vars (directly or via Tailwind's mint utilities), so the UI
 * shifts mint → blue without threading a colour prop through every component.
 */
const DELOAD_VARS: CSSProperties = {
  ["--color-mint" as string]: "var(--color-cool)",
  ["--color-mint-hover" as string]: "var(--color-cool-hover)",
  ["--color-mint-ink" as string]: "var(--color-cool-ink)",
  ["--color-mint-glow" as string]: "var(--color-cool-glow)",
  ["--color-mint-soft" as string]: "var(--color-cool-soft)",
  ["--color-mint-deep" as string]: "var(--color-cool-deep)",
};

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; day: SessionDay; exercises: SessionExercise[] };

export default function SessionScreen({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Mutable session state, keyed by exercise id.
  const [logged, setLogged] = useState<Record<string, LoggedMap>>({});
  const [setCounts, setSetCounts] = useState<Record<string, number>>({});
  const [deload, setDeload] = useState(false);

  const [swapId, setSwapId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  // True for the 600ms after a deload toggle: enables a smooth colour
  // transition on the whole subtree (mint ↔ blue) without slowing ordinary
  // hovers the rest of the time.
  const [deloadFading, setDeloadFading] = useState(false);

  const toggleDeload = () => {
    setDeloadFading(true);
    setDeload((v) => !v);
    window.setTimeout(() => setDeloadFading(false), 650);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [day, exercises] = await Promise.all([
        fetchSessionDay(dayId),
        fetchSessionExercises(dayId),
      ]);
      if (cancelled) return;

      if (!day) {
        setState({ status: "missing" });
        return;
      }

      // Seed logged sets + set counts from what came back.
      const seededLogged: Record<string, LoggedMap> = {};
      const seededCounts: Record<string, number> = {};
      for (const ex of exercises) {
        const map: LoggedMap = new Map();
        for (const s of ex.loggedToday) {
          map.set(s.setNumber, { weight: s.weight, reps: s.reps });
        }
        seededLogged[ex.exerciseId] = map;
        seededCounts[ex.exerciseId] = ex.prescribedSets;
      }
      setLogged(seededLogged);
      setSetCounts(seededCounts);
      setState({ status: "ready", day, exercises });
    })();
    return () => {
      cancelled = true;
    };
  }, [dayId]);

  const exercises = useMemo(
    () => (state.status === "ready" ? state.exercises : []),
    [state]
  );

  // "X of N logged" — N is the live sum of set counts, X the logged sets that
  // still fall within each exercise's current count.
  const { loggedCount, totalCount } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
      const count = setCounts[ex.exerciseId] ?? ex.prescribedSets;
      total += count;
      const map = logged[ex.exerciseId];
      if (map) {
        for (const setNumber of map.keys()) {
          if (setNumber <= count) done += 1;
        }
      }
    }
    return { loggedCount: done, totalCount: total };
  }, [exercises, setCounts, logged]);

  const handleLogSet = async (
    exerciseId: string,
    setNumber: number,
    weight: number,
    reps: number,
    rpe: number | null
  ) => {
    setError(null);
    try {
      await logSet({ exerciseId, setNumber, weight, reps, rpe, isDeload: deload });
      setLogged((prev) => {
        const map = new Map(prev[exerciseId] ?? []);
        map.set(setNumber, { weight, reps });
        return { ...prev, [exerciseId]: map };
      });
    } catch {
      setError("Couldn't save that set — check your connection and try again.");
      throw new Error("log failed"); // keeps the row's overlay open
    }
  };

  const handleSwap = async (rowId: string, replacement: ExerciseHit, scope: SwapScope) => {
    setSwapId(null);
    if (state.status !== "ready") return;

    const target = state.exercises.find((e) => e.rowId === rowId);
    if (!target) return;

    // Persist to the day's picks only when "always" and we have a real library
    // id to point the row at; "today" (or an offline catalog-only pick) stays in
    // session-local state.
    if (scope === "always" && replacement.id) {
      try {
        await swapDayExercise(rowId, replacement.id);
      } catch {
        setError("Couldn't save the swap. It's applied for today only.");
      }
    }

    const newId = replacement.id ?? target.exerciseId;
    const swapped: SessionExercise = {
      ...target,
      exerciseId: newId,
      name: replacement.name,
      muscleGroup: replacement.muscleGroup,
      formCue: replacement.formCue,
      // A different lift carries no history into this session's suggestions.
      last: { weight: null, allRepsHit: false },
      lastWeight: null,
      loggedToday: [],
    };

    setState({
      status: "ready",
      day: state.day,
      exercises: state.exercises.map((e) => (e.rowId === rowId ? swapped : e)),
    });
    setLogged((prev) => ({ ...prev, [newId]: new Map() }));
    setSetCounts((prev) => ({ ...prev, [newId]: target.prescribedSets }));
  };

  const handleAdd = async (pick: ExerciseHit, scope: AddScope) => {
    setAdding(false);
    if (state.status !== "ready") return;
    setError(null);
    try {
      const added = await addSessionExercise(dayId, pick, scope);
      setState({
        status: "ready",
        day: state.day,
        exercises: [...state.exercises, added],
      });
      setLogged((prev) => ({ ...prev, [added.exerciseId]: new Map() }));
      setSetCounts((prev) => ({
        ...prev,
        [added.exerciseId]: added.prescribedSets,
      }));
    } catch {
      setError("Couldn't add that exercise — check your connection and try again.");
    }
  };

  const handleFinish = async () => {
    if (finishing || state.status !== "ready") return;
    setFinishing(true);
    setError(null);
    try {
      await finishSession(dayId, deload);
      setCelebrating(true);
      // Let the gem pulse before returning to the dashboard.
      setTimeout(() => router.push("/train"), 1700);
    } catch {
      setFinishing(false);
      setError("Couldn't finish the session. Try again.");
    }
  };

  // ---------- loading / missing ----------
  if (state.status === "loading") {
    return (
      <div className="w-full px-5 pb-28 pt-8 md:px-8">
        <div className="home-skeleton h-10 w-40 rounded-lg" />
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="home-skeleton h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="w-full px-5 pb-28 pt-8 md:px-8">
        <Link
          href="/train"
          className="mono inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <BackIcon size={16} /> Today&apos;s session
        </Link>
        <div className="card mt-8 p-6" data-no-vitality>
          <p className="serif-italic text-xl" data-no-vitality>
            Session not found
          </p>
          <p className="mt-2 text-sm text-muted">
            This training day isn&apos;t in your split anymore.
          </p>
        </div>
      </div>
    );
  }

  const { day } = state;

  return (
    <div
      className={`relative w-full px-5 pb-40 pt-8 md:px-8 lg:px-12 ${
        deloadFading ? "vt-deload-fade" : ""
      }`}
      style={deload ? DELOAD_VARS : undefined}
    >
      {/* ---------- top bar ---------- */}
      <Link
        href="/train"
        className="mono inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
      >
        <BackIcon size={15} /> Today&apos;s session
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="serif-italic text-4xl leading-tight" data-no-vitality>
            {day.name}
          </h1>
          <p className="mono mt-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-muted">
            Day {day.dayNumber} of {day.trainingDayCount || 1}
          </p>
        </div>

        <Link
          href="/onboarding/training"
          aria-label="Session settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-fg"
          style={{ borderColor: "var(--color-border)" }}
        >
          <GearIcon size={17} />
        </Link>
      </header>

      {/* progress indicator */}
      <p
        className="mono mt-3 text-[0.7rem] tracking-[0.05em] text-muted"
        aria-live="polite"
      >
        <span style={{ color: "var(--color-mint)" }}>{loggedCount}</span> of{" "}
        {totalCount} logged
      </p>

      {/* ---------- exercise cards ---------- */}
      {exercises.length === 0 ? (
        <div className="card mt-6 p-6" data-no-vitality>
          <p className="serif-italic text-xl" data-no-vitality>
            No exercises yet
          </p>
          <p className="mt-2 text-sm text-muted">
            Add some picks for this day and they&apos;ll show up here to log.
          </p>
          <Link href="/onboarding/pick-exercises" className="btn-primary mt-4" data-no-vitality>
            Pick exercises →
          </Link>
        </div>
      ) : (
        <div className="mt-2">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.rowId}
              exercise={ex}
              setCount={setCounts[ex.exerciseId] ?? ex.prescribedSets}
              deload={deload}
              logged={logged[ex.exerciseId] ?? new Map()}
              onLogSet={(setNumber, w, r, rpe) =>
                handleLogSet(ex.exerciseId, setNumber, w, r, rpe)
              }
              onSwap={() => setSwapId(ex.rowId)}
              onHistory={() => setHistoryId(ex.exerciseId)}
              onSetCountChange={(next) =>
                setSetCounts((prev) => ({ ...prev, [ex.exerciseId]: next }))
              }
            />
          ))}
        </div>
      )}

      {/* manual add — search the library or create a custom exercise */}
      <button
        type="button"
        data-no-vitality
        onClick={() => setAdding(true)}
        className="mono mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-mint hover:text-fg"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "transparent",
          color: "var(--color-muted-strong)",
        }}
      >
        <PlusIcon size={14} />
        Add exercise manually
      </button>

      {error && (
        <p className="mt-5 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      {/* ---------- footer actions ---------- */}
      <div className="mt-8 flex flex-col gap-4">
        {/* deload toggle */}
        <button
          type="button"
          data-no-vitality
          role="switch"
          aria-checked={deload}
          onClick={toggleDeload}
          className="flex items-center justify-between rounded-xl border p-4 text-left"
          style={{
            borderColor: deload ? "var(--color-mint)" : "var(--color-border-strong)",
            background: deload ? "var(--color-cool-tint)" : "var(--color-card)",
          }}
        >
          <div>
            <p className="text-sm font-medium" style={{ fontStyle: "normal" }}>
              Deload this session
            </p>
            <p className="mono mt-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-muted">
              Back off to 60% of last weight
            </p>
          </div>
          <span
            className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            style={{
              background: deload ? "var(--color-mint)" : "var(--color-border-strong)",
            }}
            aria-hidden
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-fg transition-all"
              style={{ left: deload ? "1.375rem" : "0.125rem" }}
            />
          </span>
        </button>

        {/* finish */}
        <button
          type="button"
          className="btn-primary w-full"
          onClick={handleFinish}
          disabled={finishing}
        >
          {finishing ? "Finishing…" : "Finish session"}
          <StarIcon size={15} />
        </button>
      </div>

      {/* ---------- sheets ---------- */}
      {swapId &&
        (() => {
          const target = exercises.find((e) => e.rowId === swapId);
          if (!target) return null;
          return (
            <SwapSheet
              currentName={target.name}
              onClose={() => setSwapId(null)}
              onConfirm={(replacement, scope) =>
                handleSwap(swapId, replacement, scope)
              }
            />
          );
        })()}

      {adding && (
        <AddExerciseSheet
          dayName={day.name}
          takenNames={new Set(exercises.map((e) => e.name.toLowerCase()))}
          onClose={() => setAdding(false)}
          onConfirm={(pick, scope) => void handleAdd(pick, scope)}
        />
      )}

      {historyId &&
        (() => {
          const target = exercises.find((e) => e.exerciseId === historyId);
          if (!target) return null;
          return (
            <HistorySheet
              exerciseId={historyId}
              exerciseName={target.name}
              onClose={() => setHistoryId(null)}
            />
          );
        })()}

      {/* ---------- finish celebration ---------- */}
      {celebrating && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          aria-hidden
        >
          <div className="relative flex items-center justify-center">
            {/* burst of mint particles radiating outward behind the gem */}
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="vt-particle"
                style={{
                  ["--vt-angle" as string]: `${(360 / 10) * i}deg`,
                  ["--vt-dist" as string]: `${96 + (i % 3) * 18}px`,
                }}
              />
            ))}
            <div className="vt-celebrate">
              <ImperiumGem size={120} showChevron={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
