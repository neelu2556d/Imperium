"use client";

import { useRouter } from "next/navigation";

/**
 * Placeholder for the "build your own" custom day-builder the split screen
 * links to via "+ Build your own". The real editor is built separately; this
 * keeps the branch navigable and lets the user return to the templates.
 */
export default function CustomSplitScreen() {
  const router = useRouter();

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
        — Build your own
      </p>

      <h1 className="mt-3 text-3xl">Your split, your rules.</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The custom day-builder is coming soon — you&rsquo;ll name each day and
        set which ones are training vs. rest. For now, head back and pick a
        template to get started.
      </p>

      <button
        type="button"
        className="btn-primary mt-8 w-full"
        onClick={() => router.push("/onboarding/split")}
      >
        Back to templates →
      </button>
    </div>
  );
}
