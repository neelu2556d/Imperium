"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/supabase/onboarding";
import { setOnboardingCompleteCookie } from "@/lib/onboarding/cookie";
import { fetchTrainingSplit } from "@/lib/supabase/split";
import type { SplitDay } from "@/lib/split/templates";

/**
 * Placeholder for the exercise-picker screen the split screen hands off to.
 * The real /onboarding/exercises experience is built separately; this shows the
 * split the user just chose and keeps the flow finishable end-to-end.
 */
export default function ExercisesScreen() {
  const router = useRouter();
  const [days, setDays] = useState<SplitDay[] | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTrainingSplit()
      .then((d) => !cancelled && setDays(d))
      .catch(() => !cancelled && setDays([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await completeOnboarding();
      setOnboardingCompleteCookie();
      router.replace("/train");
    } catch {
      setFinishing(false);
    }
  };

  const trainingDays = (days ?? []).filter((d) => !d.isRest);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <button
        type="button"
        aria-label="Go back"
        data-no-vitality
        onClick={() => router.push("/onboarding/split")}
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
        — Your exercises
      </p>

      <h1 className="mt-3 text-3xl">Now, the movements.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We&rsquo;ll fill each day with exercises next. This screen is coming
        soon — here&rsquo;s the split you just locked in.
      </p>

      <div className="mt-7 flex flex-col gap-2">
        {trainingDays.map((day, index) => (
          <div
            key={index}
            className="rounded-lg border p-3 text-sm"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-card-elevated)",
            }}
          >
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
              Day {index + 1}
            </span>
            <div className="serif-italic text-lg leading-tight">{day.name}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary mt-8 w-full"
        disabled={finishing}
        onClick={handleFinish}
      >
        {finishing ? "Finishing…" : "Finish setup →"}
      </button>
    </div>
  );
}
