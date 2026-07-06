import Link from "next/link";
import { ArrowIcon } from "@/components/home/icons";
import type { NutritionGoals } from "@/lib/supabase/nutrition";

/**
 * Section 4 — a compact readout of the user's macro targets with an "Edit →"
 * link to /settings/nutrition, where the goals are actually adjusted.
 */
export default function GoalsCard({ goals }: { goals: NutritionGoals }) {
  return (
    <section
      className="flex items-center justify-between gap-4 rounded-2xl border p-5"
      data-no-vitality
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <div className="min-w-0">
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
          Your targets
        </p>
        <p className="mono mt-1.5 text-[0.82rem] tabular-nums text-muted-strong">
          {Math.round(goals.calories)} kcal · {Math.round(goals.protein_g)}g
          protein · {Math.round(goals.fat_g)}g fat · {Math.round(goals.carbs_g)}
          g carbs
        </p>
      </div>
      <Link
        href="/settings/nutrition"
        className="link mono flex shrink-0 items-center gap-1 text-[0.75rem]"
      >
        Edit
        <ArrowIcon size={13} />
      </Link>
    </section>
  );
}
