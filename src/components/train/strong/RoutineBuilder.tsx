"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/toast";
import { PlusIcon, TrashIcon } from "@/components/train/icons";
import AddExerciseSheet from "@/components/train/strong/AddExerciseSheet";
import {
  createRoutine,
  deleteRoutine,
  fetchRoutineExercises,
  fetchRoutines,
  setRoutineExercises,
  updateRoutine,
  type RoutineExerciseDraft,
} from "@/lib/supabase/workouts";

interface Draft extends RoutineExerciseDraft {
  key: string;
}

/** Create / edit a routine: name + an ordered list of exercises with defaults. */
export default function RoutineBuilder({ routineId }: { routineId?: string }) {
  const router = useRouter();
  const editing = Boolean(routineId);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!routineId);

  useEffect(() => {
    if (!routineId) return;
    (async () => {
      const [routines, exercises] = await Promise.all([
        fetchRoutines(),
        fetchRoutineExercises(routineId),
      ]);
      const r = routines.find((x) => x.id === routineId);
      if (r) {
        setName(r.name);
        setNotes(r.notes ?? "");
      }
      setDrafts(
        exercises.map((e, i) => ({
          key: `${e.id}-${i}`,
          exercise_name: e.exercise_name,
          exercise_id: e.exercise_id,
          default_sets: e.default_sets,
          default_reps: e.default_reps,
          default_weight_kg: e.default_weight_kg,
        }))
      );
      setReady(true);
    })();
  }, [routineId]);

  const addExercise = (exName: string, exId: string | null) => {
    setDrafts((cur) => [
      ...cur,
      { key: `${exName}-${Date.now()}`, exercise_name: exName, exercise_id: exId, default_sets: 3, default_reps: 8, default_weight_kg: 0 },
    ]);
  };

  const patch = (key: string, p: Partial<Draft>) =>
    setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...p } : d)));

  const remove = (key: string) => setDrafts((cur) => cur.filter((d) => d.key !== key));

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      pushToast("Give the routine a name.");
      return;
    }
    setSaving(true);
    try {
      const id = routineId ?? (await createRoutine(name.trim(), notes.trim() || undefined));
      if (routineId) await updateRoutine(routineId, { name: name.trim(), notes: notes.trim() || null });
      await setRoutineExercises(
        id,
        drafts.map((d) => ({
          exercise_name: d.exercise_name,
          exercise_id: d.exercise_id,
          default_sets: d.default_sets,
          default_reps: d.default_reps,
          default_weight_kg: d.default_weight_kg,
        }))
      );
      pushToast(editing ? "Routine updated" : "Routine created");
      router.push("/train");
    } catch {
      pushToast("Couldn't save the routine.");
      setSaving(false);
    }
  };

  const removeRoutine = async () => {
    if (!routineId) return;
    try {
      await deleteRoutine(routineId);
      pushToast("Routine deleted");
      router.push("/train");
    } catch {
      pushToast("Couldn't delete the routine.");
    }
  };

  // __APPEND_RB__

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8" style={{ opacity: ready ? 1 : 0.6 }}>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/train")}
          aria-label="Back"
          data-no-vitality
          className="rounded-full border p-2"
          style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--color-fg)" }}
        >
          ←
        </button>
        <h1 className="serif-italic text-2xl" data-no-vitality>
          {editing ? "Edit routine" : "New routine"}
        </h1>
      </header>

      <input
        type="text"
        value={name}
        placeholder="Routine name"
        onChange={(e) => setName(e.target.value)}
        data-no-vitality
        className="mt-5 w-full"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.7rem 0.9rem", color: "var(--color-fg)", fontSize: "1.1rem" }}
      />
      <input
        type="text"
        value={notes}
        placeholder="Notes (optional)"
        onChange={(e) => setNotes(e.target.value)}
        data-no-vitality
        className="mt-3 w-full"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.6rem 0.9rem", color: "var(--color-fg)" }}
      />

      <div className="mt-5 flex flex-col gap-3">
        {drafts.map((d) => (
          <section
            key={d.key}
            className="rounded-2xl border p-4"
            data-no-vitality
            style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.95rem] font-medium" style={{ color: "var(--accent)" }}>
                {d.exercise_name}
              </span>
              <button type="button" onClick={() => remove(d.key)} aria-label="Remove" data-no-vitality style={{ background: "transparent", border: "none", color: "var(--color-muted)" }}>
                <TrashIcon size={16} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                { k: "default_sets", label: "Sets" },
                { k: "default_reps", label: "Reps" },
                { k: "default_weight_kg", label: "Weight kg" },
              ] as const).map((f) => (
                <label key={f.k} className="flex flex-col gap-1">
                  <span className="mono text-[0.55rem] uppercase tracking-[0.1em] text-muted">{f.label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={d[f.k]}
                    onChange={(e) => patch(d.key, { [f.k]: Number(e.target.value) || 0 } as Partial<Draft>)}
                    className="mono tabular-nums"
                    data-no-vitality
                    style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.45rem", color: "var(--color-fg)" }}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAdding(true)}
        data-no-vitality
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-[0.82rem]"
        style={{ borderColor: "var(--accent)", background: "transparent", color: "var(--accent)" }}
      >
        <PlusIcon size={16} /> Add exercise
      </button>

      <button type="button" onClick={save} disabled={saving} className="btn-primary mt-5 w-full">
        {saving ? "Saving…" : editing ? "Save routine" : "Create routine"}
      </button>

      {editing && (
        <button type="button" onClick={removeRoutine} data-no-vitality className="mx-auto mt-4 block text-[0.78rem]" style={{ background: "transparent", border: "none", color: "var(--danger)" }}>
          Delete routine
        </button>
      )}

      {adding && <AddExerciseSheet onPick={addExercise} onClose={() => setAdding(false)} />}
    </div>
  );
}
