"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/toast";
import { PlusIcon, TrashIcon } from "@/components/train/icons";
import SetRow from "@/components/train/strong/SetRow";
import AddExerciseSheet from "@/components/train/strong/AddExerciseSheet";
import RestTimer from "@/components/train/strong/RestTimer";
import { formatClock, getTrainSettings } from "@/lib/train/settings";
import {
  addSessionExercise,
  addSet,
  deleteSessionExercise,
  deleteSet,
  discardSession,
  fetchSessionDetail,
  finishSession,
  setCompleted,
  updateSessionNotes,
  updateSet,
  type SessionDetail,
  type SessionExercise,
  type SessionSet,
} from "@/lib/supabase/workouts";

/** The live workout screen: log sets, rest between them, then finish. */
export default function WorkoutScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const settings = getTrainSettings();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    fetchSessionDetail(sessionId).then((d) => {
      if (d) setDetail(d);
      else setMissing(true);
    });
  }, [sessionId]);

  // Elapsed clock, ticking from started_at.
  useEffect(() => {
    if (!detail) return;
    const started = new Date(detail.session.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000)));
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [detail]);

  // Rest countdown.
  useEffect(() => {
    if (rest == null || rest <= 0) return;
    const id = setTimeout(() => setRest((r) => (r == null || r <= 1 ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  // Patch one set within the nested detail state.
  const patchSet = useCallback(
    (exId: string, setId: string, patch: Partial<SessionSet>) => {
      setDetail((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          exercises: cur.exercises.map((ex) =>
            ex.id !== exId
              ? ex
              : { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          ),
        };
      });
    },
    []
  );

  const commitSet = (ex: SessionExercise, set: SessionSet, patch: { weight_kg?: number; reps?: number }) => {
    patchSet(ex.id, set.id, patch);
    updateSet(set.id, patch).catch(() => pushToast("Couldn't save that set."));
  };

  const toggleSet = async (ex: SessionExercise, set: SessionSet, completed: boolean) => {
    patchSet(ex.id, set.id, { is_completed: completed });
    if (completed) setRest(settings.restSeconds);
    try {
      await setCompleted(set, completed);
    } catch {
      patchSet(ex.id, set.id, { is_completed: !completed });
      pushToast("Couldn't update that set.");
    }
  };

  const addNewSet = async (ex: SessionExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    const setNumber = (last?.set_number ?? 0) + 1;
    const seed = { weight_kg: last?.weight_kg ?? 0, reps: last?.reps ?? 0 };
    const id = await addSet({ id: ex.id, exercise_id: ex.exercise_id, exercise_name: ex.exercise_name }, setNumber, seed);
    if (!id) {
      pushToast("Couldn't add a set.");
      return;
    }
    const newSet: SessionSet = {
      id,
      session_exercise_id: ex.id,
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      set_number: setNumber,
      weight_kg: seed.weight_kg,
      reps: seed.reps,
      is_completed: false,
      is_warmup: false,
      rpe: null,
    };
    setDetail((cur) =>
      !cur ? cur : { ...cur, exercises: cur.exercises.map((e) => (e.id === ex.id ? { ...e, sets: [...e.sets, newSet] } : e)) }
    );
  };

  const removeSet = (ex: SessionExercise, set: SessionSet) => {
    setDetail((cur) =>
      !cur ? cur : { ...cur, exercises: cur.exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) } : e)) }
    );
    deleteSet(set.id).catch(() => pushToast("Couldn't delete that set."));
  };

  const addExercise = async (name: string, exerciseId: string | null) => {
    await addSessionExercise(sessionId, name, exerciseId);
    const fresh = await fetchSessionDetail(sessionId);
    if (fresh) setDetail(fresh);
  };

  const removeExercise = (ex: SessionExercise) => {
    setDetail((cur) => (!cur ? cur : { ...cur, exercises: cur.exercises.filter((e) => e.id !== ex.id) }));
    deleteSessionExercise(ex.id).catch(() => pushToast("Couldn't remove that exercise."));
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const { volume } = await finishSession(sessionId);
      pushToast(`Workout complete · ${Math.round(volume).toLocaleString()} kg volume`);
      router.push("/train");
    } catch {
      pushToast("Couldn't finish the workout.");
      setFinishing(false);
    }
  };

  const discard = async () => {
    try {
      await discardSession(sessionId);
      pushToast("Workout discarded");
    } catch {
      // still leave the screen; the row is inactive at worst
    }
    router.push("/train");
  };

  if (missing) {
    return (
      <div className="mx-auto w-full max-w-md px-5 pt-16 text-center md:max-w-lg">
        <p className="text-muted">That workout couldn&apos;t be found.</p>
        <button type="button" onClick={() => router.push("/train")} className="mt-4">
          Back to Train
        </button>
      </div>
    );
  }

  if (!detail) {
    return <div className="mx-auto w-full max-w-md px-5 pt-16 text-center text-muted md:max-w-lg">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-40 pt-8 md:max-w-lg md:px-8">
      <header className="flex items-center justify-between">
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
        <span className="mono text-lg tabular-nums" style={{ color: "var(--accent)" }}>
          {formatClock(elapsed)}
        </span>
        <button type="button" onClick={finish} disabled={finishing} className="btn-primary text-[0.8rem]">
          {finishing ? "Finishing…" : "Finish"}
        </button>
      </header>

      <h1 className="serif-italic mt-4 text-3xl leading-tight" data-no-vitality>
        {detail.session.name}
      </h1>

      <div className="mt-5 flex flex-col gap-4">
        {detail.exercises.map((ex) => (
          <section
            key={ex.id}
            className="rounded-2xl border p-4"
            data-no-vitality
            style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[0.98rem] font-semibold" style={{ color: "var(--accent)" }}>
                {ex.exercise_name}
              </h2>
              <button
                type="button"
                onClick={() => removeExercise(ex)}
                aria-label="Remove exercise"
                data-no-vitality
                style={{ background: "transparent", border: "none", color: "var(--color-muted)" }}
              >
                <TrashIcon size={16} />
              </button>
            </div>

            <div
              className="mono mt-2 grid gap-2 text-[0.6rem] uppercase tracking-[0.1em] text-muted"
              style={{ gridTemplateColumns: "28px 1fr 1fr 40px 28px" }}
            >
              <span className="text-center">Set</span>
              <span className="text-center">{settings.unit}</span>
              <span className="text-center">Reps</span>
              <span className="text-center">✓</span>
              <span />
            </div>

            {ex.sets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                unit={settings.unit}
                onCommit={(patch) => commitSet(ex, s, patch)}
                onToggle={(c) => toggleSet(ex, s, c)}
                onDelete={() => removeSet(ex, s)}
              />
            ))}

            <button
              type="button"
              onClick={() => addNewSet(ex)}
              data-no-vitality
              className="mono mt-2 w-full rounded-lg border py-1.5 text-[0.72rem]"
              style={{ borderColor: "var(--color-border)", background: "transparent", color: "var(--color-muted-strong)" }}
            >
              + Add set
            </button>
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

      <textarea
        placeholder="Workout notes…"
        defaultValue={detail.session.notes ?? ""}
        onBlur={(e) => updateSessionNotes(sessionId, e.target.value)}
        data-no-vitality
        className="mt-4 w-full"
        rows={2}
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0.6rem 0.7rem", color: "var(--color-fg)" }}
      />

      <button
        type="button"
        onClick={discard}
        data-no-vitality
        className="mx-auto mt-4 block text-[0.78rem]"
        style={{ background: "transparent", border: "none", color: "var(--danger)" }}
      >
        Discard workout
      </button>

      {rest != null && rest > 0 && (
        <RestTimer seconds={rest} onSkip={() => setRest(null)} onAdd={() => setRest((r) => (r ?? 0) + 15)} />
      )}

      {adding && <AddExerciseSheet onPick={addExercise} onClose={() => setAdding(false)} />}
    </div>
  );
}
