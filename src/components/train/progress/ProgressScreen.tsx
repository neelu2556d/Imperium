"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressGraph from "@/components/train/progress/ProgressGraph";
import { BackIcon } from "@/components/train/session/icons";
import { fetchExerciseName } from "@/lib/supabase/session";

/**
 * Full-screen home for one exercise's progressive-overload graph, reachable
 * from the "View progress →" link in the history sheet (or directly by URL).
 * It's a thin frame around <ProgressGraph>, which owns all the data + chart.
 */
export default function ProgressScreen({
  exerciseId,
}: {
  exerciseId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExerciseName(exerciseId).then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  return (
    <div className="w-full px-5 pb-28 pt-8 md:px-8 lg:px-12">
      <button
        type="button"
        onClick={() => router.back()}
        data-no-vitality
        className="mono inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[0.7rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
      >
        <BackIcon size={15} /> Back
      </button>

      <header className="mt-3">
        <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          Progressive overload
        </p>
        <h1 className="serif-italic mt-1 text-4xl leading-tight" data-no-vitality>
          {name ?? "Exercise"}
        </h1>
      </header>

      <div
        className="mt-6 rounded-2xl border p-5"
        data-no-vitality
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-card)",
        }}
      >
        <ProgressGraph exerciseId={exerciseId} height={300} />
      </div>

      <div className="mono mt-4 flex items-center gap-4 text-[0.6rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "var(--color-mint)" }}
          />
          Top-set weight
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{
              background: "var(--color-mint-soft)",
              opacity: 0.5,
            }}
          />
          Total volume
        </span>
      </div>
    </div>
  );
}
