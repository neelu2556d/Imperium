"use client";

import { useEffect, useRef, useState } from "react";
import { useSheet } from "@/lib/useSheet";
import { searchExercises, type ExerciseHit } from "@/lib/supabase/exercises";

interface AddExerciseSheetProps {
  onPick: (name: string, exerciseId: string | null) => void;
  onClose: () => void;
}

/** Bottom sheet to add an exercise to the session — library search or free text. */
export default function AddExerciseSheet({ onPick, onClose }: AddExerciseSheetProps) {
  const { backdropClassName, panelClassName, panelRef, panelStyle, handleProps, handleStyle, close } = useSheet(onClose);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ExerciseHit[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const query = q.trim();
    debounce.current = setTimeout(
      async () => {
        if (query.length < 2) {
          setHits([]);
          return;
        }
        try {
          setHits(await searchExercises(query));
        } catch {
          setHits([]);
        }
      },
      query.length < 2 ? 0 : 300
    );
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const pick = (name: string, id: string | null) => {
    onPick(name, id);
    close();
  };

  const typed = q.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className={`absolute inset-0 ${backdropClassName}`} style={{ background: "rgba(0,0,0,0.55)" }} onClick={close} aria-hidden />
      <div
        ref={panelRef}
        className={`relative flex w-full max-w-md flex-col rounded-t-2xl border-x border-t p-6 pb-8 ${panelClassName}`}
        style={{ borderColor: "var(--color-border-strong)", background: "var(--color-bg-elevated)", maxHeight: "80vh", ...panelStyle }}
        role="dialog"
        aria-label="Add exercise"
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full" style={{ background: "var(--color-border-strong)", ...handleStyle }} aria-hidden {...handleProps} />
        <input
          type="text"
          value={q}
          autoFocus
          placeholder="Search exercises…"
          onChange={(e) => setQ(e.target.value)}
          data-no-vitality
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.7rem 0.9rem", color: "var(--color-fg)" }}
        />
        <div className="mt-3 flex flex-col gap-2 overflow-y-auto">
          {hits.map((h) => (
            <button
              key={`${h.id}-${h.name}`}
              type="button"
              onClick={() => pick(h.name, h.id)}
              data-no-vitality
              className="rounded-xl border px-4 py-3 text-left"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
            >
              <span className="block text-[0.9rem] font-medium">{h.name}</span>
              {h.muscleGroup && <span className="block text-[0.72rem] text-muted">{h.muscleGroup}</span>}
            </button>
          ))}
          {typed.length >= 2 && !hits.some((h) => h.name.toLowerCase() === typed.toLowerCase()) && (
            <button
              type="button"
              onClick={() => pick(typed, null)}
              data-no-vitality
              className="rounded-xl border px-4 py-3 text-left"
              style={{ borderColor: "var(--accent)", background: "transparent", color: "var(--accent)" }}
            >
              + Add “{typed}” as a custom exercise
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
