"use client";

import { useState } from "react";
import Link from "next/link";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";

/**
 * The 'setup' hub — step 2 of the onboarding flow. Fans out to the two quick
 * sub-screens (fuel targets and mentor personality); each saves, records
 * itself in completed_steps via markStepComplete, and returns here. Once both
 * are done, Continue advances the linear flow to the training quiz.
 */

interface SubTask {
  /** Id recorded in user_onboarding.completed_steps by the sub-screen. */
  id: "macros" | "mentor";
  href: string;
  title: string;
  subtitle: string;
}

const SUB_TASKS: SubTask[] = [
  {
    id: "macros",
    href: "/onboarding/macros",
    title: "Set your fuel targets",
    subtitle: "Daily calories and macros — I'll track everything against them.",
  },
  {
    id: "mentor",
    href: "/onboarding/mentor",
    title: "Tune your mentor",
    subtitle: "Pick the tone and focus you want from me.",
  },
];

export default function SetupStep() {
  const onboarding = useOnboarding();
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = new Set(
    onboarding.status === "ready" ? onboarding.completedSteps : []
  );
  const allDone = SUB_TASKS.every((task) => completed.has(task.id));

  const handleContinue = async () => {
    if (onboarding.status !== "ready" || !allDone || advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      // Marks 'setup' completed, advances current_step, and navigates to
      // /onboarding/training.
      await onboarding.completeStep("setup");
    } catch (err) {
      setAdvancing(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save. Please try again."
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link
        href="/onboarding/about"
        aria-label="Go back"
        data-no-vitality
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-fg/70 transition-colors hover:text-fg"
      >
        <svg
          width="20"
          height="20"
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
      </Link>

      <p
        className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        Set you up · Step 2 of 4
      </p>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={50}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          data-no-vitality
          className="h-full rounded-full"
          style={{ width: "50%", background: "var(--color-mint)" }}
        />
      </div>

      <h1 className="mt-8 text-3xl">Two quick things.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Knock these out and I&rsquo;ll have everything I need to coach you
        properly.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {SUB_TASKS.map((task) => {
          const done = completed.has(task.id);
          return (
            <Link
              key={task.id}
              href={task.href}
              data-no-vitality
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:border-[var(--color-mint)]"
              style={{
                borderColor: done
                  ? "var(--color-mint)"
                  : "var(--color-border-strong)",
                background: "var(--color-card-elevated)",
              }}
            >
              {/* status badge */}
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: done
                    ? "var(--color-mint)"
                    : "rgb(var(--accent-rgb) / 0.12)",
                  color: done ? "var(--color-mint-ink)" : "var(--color-mint)",
                }}
                aria-hidden="true"
              >
                {done ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
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
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{task.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {done ? "Done — tap to adjust." : task.subtitle}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-8 w-full"
        disabled={onboarding.status !== "ready" || !allDone || advancing}
        onClick={handleContinue}
      >
        {advancing
          ? "Saving…"
          : allDone
            ? "continue →"
            : "finish both to continue"}
      </button>
    </div>
  );
}
