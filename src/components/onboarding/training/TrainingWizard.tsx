"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import {
  fetchTrainingAnswers,
  saveTrainingAnswer,
} from "@/lib/supabase/profile";
import {
  isFieldAnswered,
  mergeAnswers,
  readLocalAnswers,
  resumeStep,
  TOTAL_STEPS,
  writeLocalAnswers,
  type TrainingAnswers,
} from "@/lib/onboarding/training/answers";
import { WIZARD_STEPS } from "@/lib/onboarding/training/config";
import { pushToast } from "@/lib/toast";
import type { Patch } from "@/components/onboarding/training/types";

type Direction = "fwd" | "back";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function TrainingWizard({
  initialStep,
  redo = false,
}: {
  initialStep: number;
  /**
   * Redo mode — "Redo onboarding quiz" from Settings. The user has already
   * finished onboarding, so the completeness guard below must not bounce them
   * to /train; finishing saves the answers and returns to Settings instead of
   * advancing the onboarding flow.
   */
  redo?: boolean;
}) {
  const router = useRouter();
  const onboarding = useOnboarding();

  const [answers, setAnswers] = useState<TrainingAnswers>({});
  const [index, setIndex] = useState(() => clamp(initialStep - 1, 0, TOTAL_STEPS - 1));
  const [loaded, setLoaded] = useState(false);
  const [transition, setTransition] = useState<{ from: number; dir: Direction } | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncUrl = useCallback(
    (step: number) => {
      if (typeof window !== "undefined") {
        // Keep ?redo=1 in the URL so a mid-quiz refresh stays in redo mode.
        window.history.replaceState(
          null,
          "",
          `/onboarding/training/${step}${redo ? "?redo=1" : ""}`
        );
      }
    },
    [redo]
  );

  // Hydrate answers from Supabase (source of truth) overlaid with any local,
  // possibly-unsynced edits, then clamp to the furthest reachable step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = readLocalAnswers();
      let merged = local;
      try {
        const remote = await fetchTrainingAnswers();
        merged = mergeAnswers(remote, local);
      } catch {
        // Offline / fetch failed — fall back to whatever localStorage holds.
      }
      if (cancelled) return;
      writeLocalAnswers(merged);
      setAnswers(merged);
      const resumeIndex = clamp(initialStep, 1, resumeStep(merged)) - 1;
      setIndex(resumeIndex);
      syncUrl(resumeIndex + 1);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStep, syncUrl]);

  // Top-level guard: only render while 'training' is genuinely the live step.
  // Redo mode is exempt — a completed user is retaking the quiz on purpose.
  useEffect(() => {
    if (redo || onboarding.status !== "ready") return;
    if (onboarding.isComplete) {
      router.replace("/train");
    } else if (onboarding.currentStep !== "training") {
      router.replace(`/onboarding/${onboarding.currentStep}`);
    }
  }, [onboarding, router, redo]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const patch: Patch = useCallback((partial) => {
    setAnswers((prev) => {
      const next = { ...prev, ...partial };
      writeLocalAnswers(next);
      return next;
    });
  }, []);

  const go = (nextIndex: number, dir: Direction) => {
    setTransition({ from: index, dir });
    setIndex(nextIndex);
    syncUrl(nextIndex + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTransition(null), 280);
  };

  const persist = (i: number) => {
    const field = WIZARD_STEPS[i].field;
    const value = answers[field];
    if (value === undefined) return Promise.resolve();
    return saveTrainingAnswer(field, value).catch(() => {
      // localStorage already holds it; it'll re-sync on the next successful save.
    });
  };

  const handleBack = () => {
    if (transition) return;
    if (index === 0) {
      router.push(redo ? "/settings" : "/onboarding/setup");
      return;
    }
    go(index - 1, "back");
  };

  const handleContinue = async () => {
    if (transition || saving) return;
    if (!isFieldAnswered(answers, WIZARD_STEPS[index].field)) return;

    if (index === TOTAL_STEPS - 1) {
      setSaving(true);
      try {
        await persist(index);
        if (redo) {
          // Retake finished — answers are saved; back to Settings.
          pushToast("Onboarding quiz updated");
          router.replace("/settings");
        } else {
          await onboarding.completeStep("training"); // marks complete, routes to /onboarding/split
        }
      } catch {
        setSaving(false);
      }
      return;
    }

    void persist(index);
    go(index + 1, "fwd");
  };

  const redirecting =
    !redo &&
    onboarding.status === "ready" &&
    (onboarding.isComplete || onboarding.currentStep !== "training");

  if (!loaded || onboarding.status !== "ready" || redirecting) {
    return null;
  }

  const current = WIZARD_STEPS[index];
  const answered = isFieldAnswered(answers, current.field);
  const isLast = index === TOTAL_STEPS - 1;
  const progress = ((index + 1) / TOTAL_STEPS) * 100;

  const renderStep = (i: number) => {
    const cfg = WIZARD_STEPS[i];
    const StepComponent = cfg.Component;
    return (
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
          {cfg.section} · {i + 1} OF {TOTAL_STEPS}
        </p>
        <h1 className="mt-3 text-[1.7rem] leading-tight">{cfg.question}</h1>
        {cfg.subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{cfg.subtitle}</p>
        )}
        <div className="mt-7">
          <StepComponent answers={answers} patch={patch} />
        </div>
      </div>
    );
  };

  const enterClass = transition
    ? transition.dir === "fwd"
      ? "vt-anim-in-fwd"
      : "vt-anim-in-back"
    : "";
  const exitClass =
    transition?.dir === "fwd" ? "vt-anim-out-fwd" : "vt-anim-out-back";

  return (
    <>
      {/* thin mint progress bar pinned to the very top of the screen */}
      <div
        className="fixed inset-x-0 top-0 z-50 h-1"
        style={{ background: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label="Quiz progress"
      >
        <div
          data-no-vitality
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "var(--color-mint)",
            transition: "width 400ms var(--ease-out-soft)",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col px-6 pb-8 pt-12">
        <div className="relative flex-1 overflow-hidden">
          <div key={index} className={enterClass}>
            {renderStep(index)}
          </div>
          {transition && (
            <div
              key={`out-${transition.from}`}
              className={`pointer-events-none absolute inset-0 ${exitClass}`}
              aria-hidden="true"
            >
              {renderStep(transition.from)}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            data-no-vitality
            onClick={handleBack}
            className="text-sm text-muted transition-colors hover:text-fg"
          >
            ← back
          </button>

          {current.continueVariant === "pill" ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!answered}
              onClick={handleContinue}
            >
              continue →
            </button>
          ) : (
            <button
              type="button"
              data-no-vitality
              onClick={handleContinue}
              disabled={!answered || saving}
              className="text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              style={{ color: answered ? "var(--color-mint)" : "var(--color-muted)" }}
            >
              {isLast
                ? answered
                  ? "see your split →"
                  : "pick to see your split"
                : answered
                  ? "continue →"
                  : "pick to continue"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
