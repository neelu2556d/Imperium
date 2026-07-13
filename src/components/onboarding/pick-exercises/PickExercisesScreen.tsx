"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/supabase/onboarding";
import { setOnboardingCompleteCookie } from "@/lib/onboarding/cookie";
import { fetchTrainingSplitRows, type TrainingSplitRow } from "@/lib/supabase/split";
import {
  fetchDayExercises,
  saveAllDayExercises,
  searchExercises,
  type DayPick,
  type ExerciseHit,
} from "@/lib/supabase/exercises";
import {
  DEFAULT_PICKS,
  DEFAULT_REPS,
  DEFAULT_SETS,
  defaultPicksFor,
  searchCatalog,
} from "@/lib/split/exerciseCatalog";
import MuscleIcon from "@/components/onboarding/pick-exercises/MuscleIcon";

/** Turns a catalog/library hit into a fresh pick on the default prescription. */
function toPick(hit: ExerciseHit): DayPick {
  return { ...hit, sets: DEFAULT_SETS, reps: DEFAULT_REPS };
}

/** Offline fallback days, so the tabs still render if the split can't load. */
function fallbackDays(): TrainingSplitRow[] {
  return Object.keys(DEFAULT_PICKS).map((name, index) => ({
    id: `local-${index}`,
    name,
    isRest: false,
    restActivity: null,
    dayOrder: index + 1,
  }));
}

export default function PickExercisesScreen() {
  const router = useRouter();

  const [days, setDays] = useState<TrainingSplitRow[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [picksByDay, setPicksByDay] = useState<Record<string, DayPick[]>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseHit[]>([]);

  const [tuneIndex, setTuneIndex] = useState<number | null>(null);
  const [infoIndex, setInfoIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the training days + any saved picks; seed empty days from the defaults.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let trainingDays: TrainingSplitRow[];
      try {
        const rows = await fetchTrainingSplitRows();
        trainingDays = rows.filter((row) => !row.isRest);
        if (trainingDays.length === 0) trainingDays = fallbackDays();
      } catch {
        trainingDays = fallbackDays();
      }

      let saved: Record<string, DayPick[]> = {};
      try {
        saved = await fetchDayExercises(trainingDays.map((d) => d.id));
      } catch {
        saved = {};
      }

      const seeded: Record<string, DayPick[]> = {};
      for (const day of trainingDays) {
        const existing = saved[day.id];
        seeded[day.id] =
          existing && existing.length > 0
            ? existing
            : defaultPicksFor(day.name).map((c) =>
                toPick({
                  id: null,
                  name: c.name,
                  muscleGroup: c.muscleGroup,
                  formCue: c.formCue,
                })
              );
      }

      if (cancelled) return;
      setDays(trainingDays);
      setActiveDayId(trainingDays[0]?.id ?? null);
      setPicksByDay(seeded);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const picks = activeDayId ? picksByDay[activeDayId] ?? [] : [];

  // Debounced search: Supabase first, local catalog as the fallback. All state
  // updates happen inside the timeout, never synchronously in the effect body.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (!q) {
        if (!cancelled) setResults([]);
        return;
      }
      let hits: ExerciseHit[] = [];
      try {
        hits = await searchExercises(q);
      } catch {
        hits = [];
      }
      if (hits.length === 0) {
        hits = searchCatalog(q).map((c) => ({
          id: null,
          name: c.name,
          muscleGroup: c.muscleGroup,
          formCue: c.formCue,
        }));
      }
      if (!cancelled) setResults(hits);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const setPicks = (updater: (prev: DayPick[]) => DayPick[]) => {
    if (!activeDayId) return;
    setPicksByDay((prev) => ({ ...prev, [activeDayId]: updater(prev[activeDayId] ?? []) }));
  };

  const addPick = (hit: ExerciseHit) => {
    setPicks((prev) =>
      prev.some((p) => p.name.toLowerCase() === hit.name.toLowerCase())
        ? prev
        : [...prev, toPick(hit)]
    );
    setQuery("");
    setResults([]);
  };

  const removePick = (index: number) => {
    setPicks((prev) => prev.filter((_, i) => i !== index));
    setTuneIndex(null);
  };

  const tunePick = (index: number, next: Partial<Pick<DayPick, "sets" | "reps">>) =>
    setPicks((prev) => prev.map((p, i) => (i === index ? { ...p, ...next } : p)));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setPicks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveAllDayExercises(
        days.map((day) => ({ splitId: day.id, picks: picksByDay[day.id] ?? [] }))
      );
      await completeOnboarding();
      setOnboardingCompleteCookie();
      router.replace("/train");
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save your exercises. Try again."
      );
    }
  };

  const tuning = tuneIndex !== null ? picks[tuneIndex] : null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8 pb-28">
      {/* back */}
      <button
        type="button"
        data-no-vitality
        onClick={() => router.push("/onboarding/customize-days")}
        className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-muted transition-colors hover:text-fg"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to days
      </button>

      <h1 className="serif-italic mt-6 text-3xl">Set up your training</h1>
      <p
        className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        Step 3 of 3 · Pick exercises
      </p>

      {/* progress bar — 100% */}
      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border-strong)" }}
        role="progressbar"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: "100%", background: "var(--color-mint)" }}
        />
      </div>

      {/* day tabs */}
      <div className="mt-6 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        {days.map((day) => {
          const active = day.id === activeDayId;
          return (
            <button
              key={day.id}
              type="button"
              data-no-vitality
              onClick={() => {
                setActiveDayId(day.id);
                setTuneIndex(null);
                setInfoIndex(null);
                setQuery("");
                setResults([]);
              }}
              className="shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderColor: active ? "var(--color-mint)" : "var(--color-border-strong)",
                background: active ? "rgb(var(--accent-rgb) / 0.10)" : "transparent",
                color: active ? "var(--color-mint)" : "var(--color-muted-strong)",
              }}
              aria-pressed={active}
            >
              {day.name}
            </button>
          );
        })}
      </div>

      {/* search */}
      <div className="relative mt-5">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          data-no-vitality
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any exercise…"
          className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
          style={{
            borderColor: "var(--color-border)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        />

        {/* search results */}
        {results.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border shadow-lg"
            style={{
              borderColor: "var(--color-border-strong)",
              background: "var(--color-bg-elevated)",
            }}
          >
            {results.map((hit) => {
              const already = picks.some(
                (p) => p.name.toLowerCase() === hit.name.toLowerCase()
              );
              return (
                <button
                  key={hit.name}
                  type="button"
                  data-no-vitality
                  disabled={already}
                  onClick={() => addPick(hit)}
                  className="flex w-full items-center gap-3 border-0 border-b bg-transparent px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--accent-rgb)_/_0.08)] disabled:opacity-40"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span className="text-muted">
                    <MuscleIcon group={hit.muscleGroup} />
                  </span>
                  <span className="flex-1 text-sm">{hit.name}</span>
                  <span className="text-xs text-muted">
                    {already ? "Added" : hit.muscleGroup ?? ""}
                  </span>
                  {!already && (
                    <span className="text-[var(--color-mint)]" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* picks header */}
      <div className="mt-6 flex items-center justify-between">
        <h2
          className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
          data-no-vitality
        >
          Your picks ·
        </h2>
        <span
          className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold"
          style={{ background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--color-mint)" }}
        >
          {picks.length}
        </span>
      </div>

      {/* picks list */}
      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : picks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No exercises yet — search above to add some.
          </p>
        ) : (
          picks.map((pick, index) => (
            <div
              key={`${pick.name}-${index}`}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
                setInfoIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex.current !== null) reorder(dragIndex.current, index);
                dragIndex.current = null;
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOverIndex(null);
              }}
              className="relative flex items-center gap-2.5 rounded-xl border p-2.5"
              style={{
                borderColor:
                  dragOverIndex === index
                    ? "var(--color-mint)"
                    : "var(--color-border)",
                background: "var(--color-card-elevated)",
              }}
            >
              {/* drag handle */}
              <span
                className="shrink-0 cursor-grab text-muted active:cursor-grabbing"
                aria-hidden="true"
                title="Drag to reorder"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.4" />
                  <circle cx="15" cy="6" r="1.4" />
                  <circle cx="9" cy="12" r="1.4" />
                  <circle cx="15" cy="12" r="1.4" />
                  <circle cx="9" cy="18" r="1.4" />
                  <circle cx="15" cy="18" r="1.4" />
                </svg>
              </span>

              {/* muscle glyph */}
              <span className="shrink-0 text-[var(--color-mint)]">
                <MuscleIcon group={pick.muscleGroup} />
              </span>

              {/* name */}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {pick.name}
              </span>

              {/* prescription hint */}
              <span className="mono shrink-0 text-xs text-muted tabular-nums">
                {pick.sets}×{pick.reps}
              </span>

              {/* info */}
              <button
                type="button"
                data-no-vitality
                aria-label={`About ${pick.name}`}
                onClick={() => setInfoIndex((cur) => (cur === index ? null : index))}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted transition-colors hover:text-fg"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>

              {/* tune */}
              <button
                type="button"
                data-no-vitality
                onClick={() => setTuneIndex(index)}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:text-[var(--color-mint-ink)] hover:bg-[var(--color-mint)]"
                style={{ borderColor: "var(--color-border-strong)" }}
              >
                Tune
              </button>

              {/* info tooltip */}
              {infoIndex === index && (
                <div
                  className="absolute right-2 top-full z-10 mt-1 w-60 rounded-lg border p-3 shadow-lg"
                  style={{
                    borderColor: "var(--color-border-strong)",
                    background: "var(--color-bg-elevated)",
                  }}
                  role="tooltip"
                >
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-mint)]">
                    {pick.muscleGroup ?? "Exercise"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-strong">
                    {pick.formCue ?? "Focus on controlled reps and full range."}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      {/* sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t px-6 py-4"
        style={{
          borderColor: "var(--color-border)",
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={saving || loading}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save & go to dashboard →"}
          </button>
        </div>
      </div>

      {/* tune bottom sheet */}
      {tuning && (
        <TuneSheet
          key={tuneIndex}
          pick={tuning}
          onClose={() => setTuneIndex(null)}
          onChange={(next) => tuneIndex !== null && tunePick(tuneIndex, next)}
          onRemove={() => tuneIndex !== null && removePick(tuneIndex)}
        />
      )}
    </div>
  );
}

function TuneSheet({
  pick,
  onClose,
  onChange,
  onRemove,
}: {
  pick: DayPick;
  onClose: () => void;
  onChange: (next: Partial<Pick<DayPick, "sets" | "reps">>) => void;
  onRemove: () => void;
}) {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md rounded-t-2xl border-x border-t p-6 pb-8"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
        role="dialog"
        aria-label={`Tune ${pick.name}`}
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full"
          style={{ background: "var(--color-border-strong)" }}
          aria-hidden="true"
        />

        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
          {pick.muscleGroup ?? "Exercise"}
        </p>
        <h3 className="serif-italic mt-1 text-xl">{pick.name}</h3>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stepper
            label="Sets"
            value={pick.sets}
            onChange={(v) => onChange({ sets: clamp(v, 1, 10) })}
          />
          <Stepper
            label="Reps"
            value={pick.reps}
            onChange={(v) => onChange({ reps: clamp(v, 1, 50) })}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            data-no-vitality
            onClick={onRemove}
            className="rounded-full border px-4 py-2.5 text-sm font-semibold text-[var(--color-red)] transition-colors hover:bg-[rgba(239,68,68,0.1)]"
            style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
          >
            Remove
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none";
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between rounded-xl border p-1.5"
        style={{ borderColor: "var(--color-border-strong)", background: "var(--color-card-elevated)" }}
      >
        <button
          type="button"
          data-no-vitality
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(value - 1)}
          className={btn}
          style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
        >
          −
        </button>
        <span className="mono text-lg tabular-nums">{value}</span>
        <button
          type="button"
          data-no-vitality
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className={btn}
          style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
        >
          +
        </button>
      </div>
    </div>
  );
}
