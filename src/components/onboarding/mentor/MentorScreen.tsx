"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import { markStepComplete } from "@/lib/supabase/onboarding";
import { fetchMentorSetup, saveMentorSetup } from "@/lib/supabase/profile";
import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import Chip from "@/components/onboarding/training/primitives/Chip";

const TONES: { value: string; subtitle: string }[] = [
  { value: "Blunt", subtitle: "no fluff, just what you need to hear" },
  { value: "Encouraging", subtitle: "in your corner, always" },
  { value: "Clinical", subtitle: "data-first, emotion-last" },
];

const ALL = "All of the above";
const FOCUSES = [
  "Training performance",
  "Recovery & sleep",
  "Nutrition & macros",
  "Mental focus",
  "Progressive overload",
];

export default function MentorScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();

  const [tone, setTone] = useState<string | undefined>(undefined);
  const [focus, setFocus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill if the user has been here before.
  useEffect(() => {
    let cancelled = false;
    fetchMentorSetup()
      .then((setup) => {
        if (cancelled) return;
        if (setup.tone) setTone(setup.tone);
        if (setup.focus.length) setFocus(setup.focus);
      })
      .catch(() => {
        /* fresh start if the load fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Never show setup screens once onboarding is finished.
  useEffect(() => {
    if (onboarding.status === "ready" && onboarding.isComplete) {
      router.replace("/train");
    }
  }, [onboarding, router]);

  const allSelected = FOCUSES.every((f) => focus.includes(f));

  const toggleFocus = (value: string) => {
    if (value === ALL) {
      setFocus(allSelected ? [] : [...FOCUSES]);
      return;
    }
    setFocus((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleReady = async () => {
    if (!tone || saving) return;
    setSaving(true);
    setError(null);

    const trainingDone =
      onboarding.status === "ready" &&
      onboarding.completedSteps.includes("training");

    try {
      await saveMentorSetup(tone, focus);
      await markStepComplete("mentor");
      router.push(trainingDone ? "/train" : "/onboarding/split");
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link
        href="/onboarding/setup"
        aria-label="Go back"
        data-no-vitality
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
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
        Tune your mentor · Step 4 of 4
      </p>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={100}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          data-no-vitality
          className="h-full rounded-full"
          style={{ width: "100%", background: "var(--color-mint)" }}
        />
      </div>

      <h1 className="mt-8 text-3xl">How do you want me to show up?</h1>

      <section className="mt-8">
        <h2 data-no-vitality className="mb-3 text-sm font-medium text-muted-strong">
          Pick a tone
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {TONES.map((t) => (
            <ChoiceCard
              key={t.value}
              title={t.value}
              subtitle={t.subtitle}
              checkBadge
              selected={tone === t.value}
              onSelect={() => setTone(t.value)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 data-no-vitality className="mb-3 text-sm font-medium text-muted-strong">
          What should I focus on?
        </h2>
        <div className="flex flex-wrap gap-2">
          {FOCUSES.map((f) => (
            <Chip
              key={f}
              label={f}
              checkOnSelect
              selected={focus.includes(f)}
              onToggle={() => toggleFocus(f)}
            />
          ))}
          <Chip
            label={ALL}
            checkOnSelect
            selected={allSelected}
            onToggle={() => toggleFocus(ALL)}
          />
        </div>
      </section>

      {error && (
        <p className="mt-6 text-sm" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-10 w-full"
        disabled={!tone || saving}
        onClick={handleReady}
      >
        {saving ? "Saving…" : "I'm ready →"}
      </button>
    </div>
  );
}
