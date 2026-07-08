"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchTrainingSplitRows,
  saveTrainingSplitDays,
  type EditableDay,
} from "@/lib/supabase/split";

/** An editor row: an EditableDay plus a stable client id for React keys. */
interface DayRow extends EditableDay {
  key: number;
}

/** Monotonic key source for row identity — never read during render. */
let keySeq = 0;
const nextKey = () => keySeq++;
const toRows = (days: EditableDay[]): DayRow[] =>
  days.map((day) => ({ ...day, key: nextKey() }));

/** The spec's starting point when nothing is saved yet: 4 training days + Rest. */
const DEFAULT_DAYS: EditableDay[] = [
  { name: "Chest & Shoulders", isRest: false },
  { name: "Back", isRest: false },
  { name: "Legs", isRest: false },
  { name: "Arms", isRest: false },
  { name: "Rest", isRest: true, restActivity: null },
];

/**
 * Collapses a saved split (which may be a full Mon–Sun week with interspersed
 * rest days) into the rotation the editor works with: the unique training days
 * in order, followed by a single Rest carrying the first rest note. Round-trips
 * cleanly for lists this screen itself saved.
 */
function toEditorDays(rows: EditableDay[]): EditableDay[] {
  const training: EditableDay[] = [];
  const seen = new Set<string>();
  let rest: EditableDay | null = null;

  for (const row of rows) {
    if (row.isRest) {
      rest ??= { name: "Rest", isRest: true, restActivity: row.restActivity ?? null };
      continue;
    }
    const dedupeKey = row.name.trim().toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    training.push({ name: row.name, isRest: false });
  }

  return rest ? [...training, rest] : training;
}

export default function CustomizeDaysScreen() {
  const router = useRouter();

  const [rows, setRows] = useState<DayRow[]>(() => toRows(DEFAULT_DAYS));
  const [loaded, setLoaded] = useState(false);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [activityOpenKey, setActivityOpenKey] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefer a previously-saved split; fall back to the spec defaults offline.
  useEffect(() => {
    let cancelled = false;
    fetchTrainingSplitRows()
      .then((saved) => {
        if (cancelled) return;
        const editor = toEditorDays(saved);
        if (editor.length > 0) setRows(toRows(editor));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (key: number, next: Partial<EditableDay>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));

  const setMode = (key: number, isRest: boolean) =>
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              isRest,
              // Give a fresh rest day the conventional label; keep a custom
              // training name when switching back to DAY.
              name: isRest ? "Rest" : row.name === "Rest" ? "New day" : row.name,
              restActivity: isRest ? row.restActivity ?? null : null,
            }
          : row
      )
    );

  const removeRow = (key: number) =>
    setRows((prev) => prev.filter((row) => row.key !== key));

  const addDay = () => {
    const key = nextKey();
    setEditingKey(key);
    setRows((prev) => [...prev, { key, name: "New day", isRest: false }]);
  };

  const handleContinue = async () => {
    if (saving) return;
    const days: EditableDay[] = rows.map((row) => ({
      name: row.name.trim() || (row.isRest ? "Rest" : "Untitled"),
      isRest: row.isRest,
      restActivity: row.isRest ? row.restActivity?.trim() || null : null,
    }));

    setSaving(true);
    setError(null);
    try {
      await saveTrainingSplitDays(days);
      router.push("/onboarding/pick-exercises");
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save your days. Try again."
      );
    }
  };

  const trainingCount = rows.filter((row) => !row.isRest).length;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      {/* breadcrumb */}
      <button
        type="button"
        data-no-vitality
        onClick={() => router.push("/onboarding/split")}
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
        Fitness
      </button>

      <h1 className="serif-italic mt-6 text-3xl">Set up your training</h1>
      <p
        className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        Step 2 of 3 · Customize days
      </p>

      {/* progress bar — 66% */}
      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border-strong)" }}
        role="progressbar"
        aria-valuenow={66}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: "66%", background: "var(--color-mint)" }}
        />
      </div>

      <p className="mt-6 text-sm text-muted-strong">Name your days and mark rest.</p>

      {/* day list */}
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="rounded-xl border p-3"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-card-elevated)",
              opacity: loaded ? 1 : 0.85,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="mono text-xs tabular-nums text-muted"
                style={{ minWidth: "1.4rem" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* editable name */}
              <div className="min-w-0 flex-1">
                {editingKey === row.key && !row.isRest ? (
                  <input
                    autoFocus
                    data-no-vitality
                    value={row.name}
                    onChange={(e) => patch(row.key, { name: e.target.value })}
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        e.preventDefault();
                        setEditingKey(null);
                      }
                    }}
                    className="w-full rounded-md border bg-transparent px-2 py-1 text-base outline-none"
                    style={{
                      borderColor: "var(--color-mint)",
                      boxShadow: "0 0 0 3px var(--color-mint-glow)",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    data-no-vitality
                    disabled={row.isRest}
                    onClick={() => setEditingKey(row.key)}
                    className="group flex w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left"
                    title={row.isRest ? undefined : "Click to rename"}
                  >
                    <span
                      className={row.isRest ? "text-base text-muted" : "text-base"}
                    >
                      {row.name}
                    </span>
                    {!row.isRest && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* DAY | REST toggle */}
              <div
                className="inline-flex shrink-0 rounded-full border p-0.5"
                data-no-vitality
                style={{ borderColor: "var(--color-border-strong)" }}
              >
                {(["DAY", "REST"] as const).map((label) => {
                  const active = label === "REST" ? row.isRest : !row.isRest;
                  return (
                    <button
                      key={label}
                      type="button"
                      data-no-vitality
                      onClick={() => setMode(row.key, label === "REST")}
                      className="rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition-colors"
                      style={{
                        background: active ? "var(--color-mint)" : "transparent",
                        color: active
                          ? "var(--color-mint-ink)"
                          : "var(--color-muted)",
                      }}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* delete */}
              <button
                type="button"
                data-no-vitality
                aria-label={`Delete ${row.name}`}
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted transition-colors hover:text-[var(--color-red)] disabled:opacity-30"
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* rest activity */}
            {row.isRest && (
              <div className="mt-2 pl-[2.9rem]">
                {activityOpenKey === row.key || row.restActivity ? (
                  <input
                    autoFocus={activityOpenKey === row.key}
                    data-no-vitality
                    value={row.restActivity ?? ""}
                    placeholder="e.g. light cardio, mobility…"
                    onChange={(e) => patch(row.key, { restActivity: e.target.value })}
                    onBlur={() => setActivityOpenKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        e.preventDefault();
                        setActivityOpenKey(null);
                      }
                    }}
                    className="w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none"
                    style={{ borderColor: "var(--color-border-strong)" }}
                  />
                ) : (
                  <button
                    type="button"
                    data-no-vitality
                    onClick={() => setActivityOpenKey(row.key)}
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[var(--color-mint)] transition-colors hover:text-[var(--color-mint-hover)]"
                  >
                    + add activity
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* add day */}
      <button
        type="button"
        data-no-vitality
        onClick={addDay}
        className="mt-3 w-full rounded-full border border-dashed py-2.5 text-sm text-muted-strong transition-colors hover:text-fg"
        style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
      >
        + Add day
      </button>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      {/* footer actions */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          data-no-vitality
          onClick={() => router.push("/onboarding/split")}
          className="rounded-full border px-5 py-3 text-sm font-semibold text-muted-strong transition-colors hover:text-fg"
          style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
        >
          Back
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={saving || trainingCount === 0}
          onClick={handleContinue}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
