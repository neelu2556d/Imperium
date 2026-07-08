"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { markStepComplete } from "@/lib/supabase/onboarding";
import { fetchTrainingAnswers } from "@/lib/supabase/profile";
import { saveTrainingSplit } from "@/lib/supabase/split";
import {
  mergeAnswers,
  readLocalAnswers,
  type TrainingAnswers,
} from "@/lib/onboarding/training/answers";
import {
  getSplitTemplate,
  recommendSplit,
  SPLIT_TEMPLATES,
} from "@/lib/split/templates";
import SplitCard from "@/components/onboarding/split/SplitCard";

/**
 * /onboarding/split — the split-recommendation screen the training quiz hands
 * off to. Reads the quiz answers, pre-selects the best-fitting template (the
 * personalised 4-day split for the default profile), and on confirm writes the
 * chosen days to the training_split table before advancing to the exercise
 * picker. Rendered inside OnboardingStepGuard via the [step] route.
 */
export default function SplitStep() {
  const router = useRouter();

  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the recommendation from the quiz answers (remote row overlaid with
  // any unsynced local edits, mirroring the training wizard).
  useEffect(() => {
    let cancelled = false;
    const local = readLocalAnswers();

    const apply = (answers: TrainingAnswers) => {
      if (cancelled) return;
      const id = recommendSplit(answers);
      setRecommendedId(id);
      setSelectedId((current) => current ?? id);
    };

    fetchTrainingAnswers()
      .then((remote) => apply(mergeAnswers(remote, local)))
      .catch(() => apply(local)); // offline: fall back to local-only answers

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirm = async () => {
    const template = selectedId ? getSplitTemplate(selectedId) : undefined;
    if (!template || saving) return;

    setSaving(true);
    setError(null);
    try {
      await saveTrainingSplit(template.days);
      await markStepComplete("split");
      router.push("/onboarding/customize-days");
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save your split. Try again."
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <button
        type="button"
        aria-label="Go back"
        data-no-vitality
        onClick={() => router.push("/onboarding/training")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg/70 transition-colors hover:text-fg"
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
      </button>

      <p
        className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        — Your split
      </p>

      <h1 className="mt-3 text-3xl">Here&rsquo;s what fits you.</h1>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {SPLIT_TEMPLATES.map((template) => (
          <SplitCard
            key={template.id}
            template={template}
            selected={selectedId === template.id}
            recommended={recommendedId === template.id}
            tooltipOpen={openTooltipId === template.id}
            onSelect={() => {
              setSelectedId(template.id);
              setOpenTooltipId(null);
            }}
            onToggleTooltip={() =>
              setOpenTooltipId((current) =>
                current === template.id ? null : template.id
              )
            }
          />
        ))}
      </div>

      <button
        type="button"
        data-no-vitality
        onClick={() => router.push("/onboarding/custom-split")}
        className="mt-4 w-full rounded-xl border border-dashed py-3 text-sm text-muted-strong transition-colors hover:text-fg"
        style={{ borderColor: "var(--color-border-strong)", background: "transparent" }}
      >
        + Build your own
      </button>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      {selectedId && (
        <button
          type="button"
          className="btn-primary mt-6 w-full"
          disabled={saving}
          onClick={handleConfirm}
        >
          {saving ? "Saving…" : "Use this split →"}
        </button>
      )}
    </div>
  );
}
