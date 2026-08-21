"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/train/icons";
import { TrashIcon, EditIcon } from "@/components/train/icons";

import {
  deleteSession,
  editSession,
  fetchSessionHistory,
  type SessionHistoryEntry,
} from "@/lib/supabase/train";
import { pushToast } from "@/lib/toast";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; sessions: SessionHistoryEntry[] };

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed, Jul 8" from a local YYYY-MM-DD (parsed part-wise to avoid UTC shift). */
function formatSessionDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

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

  const handleDelete = async (date: string) => {
    if (deletingDate) return;
    if (confirmDate !== date) {
      setConfirmDate(date);
      return;
    }
    setDeletingDate(date);
    const ok = await deleteSession(date);
    setDeletingDate(null);
    setConfirmDate(null);
    if (ok) {
      pushToast("Session deleted");
      setState((prev) =>
        prev.status === "ready"
          ? { status: "ready", sessions: prev.sessions.filter((s) => s.date !== date) }
          : prev
      );
    }
  };

  const handleEdit = async (date: string) => {
    if (editingDate) return;
    if (editDate !== null && editDate !== date) {
      setEditDate(date);
      setConfirmDate(date);
      return;
    }
    setEditingDate(date);
    setEditDate(null);
    setConfirmDate(null);
    const ok = await editSession(date);
    setEditingDate(null);
    setEditDate(null);
    setConfirmDate(null);
    if (ok) {
      pushToast("Session edited");
      setState((prev) =>
        prev.status === "ready"
          ? { status: "ready", sessions: prev.sessions.map((s) => (s.date === date ? { ...s, ...ok } : s)) }
          : prev
      );
    }
  };

  const renderSession = (s: SessionHistoryEntry) => {
    const exercises = s.exercises.map((ex) => {
      const row = (
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm text-fg">{ex.name}</span>
          <span className="mono shrink-0 text-[0.68rem] text-muted-strong">
            {ex.sets} {ex.sets === 1 ? "set" : "sets"}
            {ex.topWeight != null && (
              <span style={{ color: "var(--color-mint)" }}>
                {" — "}
                {ex.topWeight}kg
                {ex.topReps != null && ` × ${ex.topReps}`}
              </span>
            )}
          </span>
        </div>
      );
      return (
        <li key={`${ex.exerciseId ?? "x"}-${s.date}-${ex.sets}`}>
          {ex.exerciseId ? (
            <Link
              href={`/train/progress/${ex.exerciseId}`}
              className="block rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--color-card-hover,rgba(255,255,255,0.03))]"
            >
              {row}
            </Link>
          ) : (
            <div className="px-1 py-0.5">{row}</div>
          )}
        </li>
      );
    });

    return (
      <article key={s.date} className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="serif-italic text-2xl leading-tight">{s.dayName ?? "Session"}</h2>
              <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                {formatSessionDate(s.date)}
              </span>
            </div>
            {s.topLift && (
              <p className="mt-1 truncate text-sm text-muted-strong">
                Top: {s.topLift.name}
                <span className="mono" style={{ color: "var(--color-mint)" }}>
                  {" — "}
                  {s.topLift.weight}kg × {s.topLift.reps}
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="serif-italic text-2xl" style={{ color: "var(--color-mint)" }}>
                {s.totalSets}
              </div>
              <div className="mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                Sets
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {editingDate === s.date ? (
                <>
                  <button
                    type="button"
                    data-no-vitality
                    aria-label="Confirm edit session"
                    disabled={confirmDate !== null && confirmDate !== s.date}
                    onClick={() => void handleEdit(s.date)}
                    className="mono flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] transition-colors"
                    style={{
                      borderColor: "var(--color-green)",
                      color: "var(--color-green)",
                      background: "transparent",
                    }}
                  >
                    <EditIcon size={13} />
                    Edit?
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-no-vitality
                    aria-label={
                      confirmDate === s.date
                        ? `Confirm edit session on ${formatSessionDate(s.date)}`
                        : `Edit session on ${formatSessionDate(s.date)}`
                    }
                    disabled={editingDate !== null}
                    onClick={() => void handleEdit(s.date)}
                    className="mono flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] transition-colors"
                    style={{
                      borderColor:
                        confirmDate === s.date
                          ? "var(--color-green)"
                          : "var(--color-border-strong)",
                      color:
                        confirmDate === s.date
                          ? "var(--color-green)"
                          : "var(--color-muted)",
                      background: "transparent",
                    }}
                  >
                    <EditIcon size={13} />
                    {confirmDate === s.date ? "Sure?" : "Edit?"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {s.exercises.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {exercises}
          </ul>
        )}
      </article>
    );
  };

  return (
    <div className="w-full px-5 pb-28 pt-8 md:px-8 lg:px-12">
      <button
        type="button"
        onClick={() => router.back()}
        data-no-vitality
        className="mono inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[0.7rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
      >
        <BackIcon size={15} />
        Back
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
              {renderSession(s)}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}