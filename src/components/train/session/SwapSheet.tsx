"use client";

import { useEffect, useState } from "react";
import MuscleIcon from "@/components/onboarding/pick-exercises/MuscleIcon";
import { SearchIcon } from "@/components/train/session/icons";
import { useSheet } from "@/lib/useSheet";
import { searchExercises, type ExerciseHit } from "@/lib/supabase/exercises";
import { searchCatalog } from "@/lib/split/exerciseCatalog";

export type SwapScope = "today" | "always";

interface SwapSheetProps {
  /** The exercise being replaced, for the header. */
  currentName: string;
  onClose: () => void;
  onConfirm: (replacement: ExerciseHit, scope: SwapScope) => void;
}

/**
 * Bottom sheet to swap an exercise. Stage one is a searchable list drawn from
 * the shared exercise library (Supabase first, local catalog as the offline
 * fallback — same pattern as pick-exercises). Selecting a result advances to an
 * info card that previews the pick, then asks whether to change it "just for
 * today" (session-local) or "always" (persisted to the day's picks).
 */
export default function SwapSheet({ currentName, onClose, onConfirm }: SwapSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseHit[]>([]);
  const [selected, setSelected] = useState<ExerciseHit | null>(null);
  const {
    backdropClassName,
    panelClassName,
    panelRef,
    panelStyle,
    handleProps,
    handleStyle,
    close,
  } = useSheet(onClose);

  // Debounced search: Supabase first, local catalog fallback.
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8 ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label={`Swap ${currentName}`}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full"
          style={{
            background: "var(--color-border-strong)",
            ...handleStyle,
          }}
          aria-hidden
          {...handleProps}
        />

        {selected ? (
          // ---------- stage two: info card + scope choice ----------
          <div className="min-h-0">
            <button
              type="button"
              data-no-vitality
              onClick={() => setSelected(null)}
              className="mb-3 border-0 bg-transparent p-0 text-sm text-muted transition-colors hover:text-fg"
            >
              ← Back to search
            </button>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--color-border-strong)", background: "var(--color-card)" }}
            >
              <div className="flex items-center gap-2 text-[var(--color-mint)]">
                <MuscleIcon group={selected.muscleGroup} size={18} />
                <span className="mono text-[0.6rem] uppercase tracking-[0.14em]">
                  {selected.muscleGroup ?? "Exercise"}
                </span>
              </div>
              <h3 className="serif-italic mt-2 text-2xl">{selected.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">
                {selected.formCue ?? "Focus on controlled reps and full range."}
              </p>
            </div>

            <p className="mt-4 text-center text-sm text-muted">
              Replace <span className="text-fg">{currentName}</span> with{" "}
              <span className="text-fg">{selected.name}</span>?
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => onConfirm(selected, "today")}
              >
                Change just for today
              </button>
              <button
                type="button"
                data-no-vitality
                onClick={() => onConfirm(selected, "always")}
                className="w-full rounded-pill px-4 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  border: "1px solid var(--color-border-strong)",
                  background: "transparent",
                  color: "var(--color-fg)",
                }}
              >
                Change always
              </button>
            </div>
          </div>
        ) : (
          // ---------- stage one: search + results ----------
          <>
            <p className="mono shrink-0 text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              Swap out · {currentName}
            </p>

            <div className="relative mt-3 shrink-0">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              >
                <SearchIcon size={16} />
              </span>
              <input
                data-no-vitality
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any exercise…"
                className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none"
                style={{
                  borderColor: "var(--color-border)",
                  background: "rgba(255,255,255,0.03)",
                }}
                autoFocus
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  {query.trim()
                    ? "No matches — try another name."
                    : "Search the library for a replacement."}
                </p>
              ) : (
                <div className="flex flex-col">
                  {results.map((hit) => (
                    <button
                      key={hit.name}
                      type="button"
                      data-no-vitality
                      onClick={() => setSelected(hit)}
                      className="flex w-full items-center gap-3 border-0 bg-transparent px-1 py-2.5 text-left transition-colors hover:text-[var(--color-mint)]"
                    >
                      <span className="text-muted">
                        <MuscleIcon group={hit.muscleGroup} />
                      </span>
                      <span className="flex-1 text-sm">{hit.name}</span>
                      <span className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                        {hit.muscleGroup ?? ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
