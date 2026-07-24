"use client";

import { useRouter } from "next/navigation";
import { rupees } from "../orders/orderFormat";
import type { PartyRow } from "@/lib/supabase/parties";

/**
 * Party card for the parties list. Shows party name, area/city, and three
 * inline stats: Total orders | Total sale value | Outstanding amount.
 * Outstanding amount is amber if > 0.
 */
export default function PartyCard({ party }: { party: PartyRow }) {
  const router = useRouter();

  const hasOutstanding = party.outstandingAmount > 0;
  const isPending = hasOutstanding;

  return (
    <li
      role="button"
      tabIndex={0}
      data-no-vitality
      onClick={() => router.push(`/business/parties/${party.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/business/parties/${party.id}`);
        }
      }}
      className="cursor-pointer rounded-xl border border-border bg-bg-elevated px-4 py-3 transition-colors hover:border-mint"
    >
      {/* Party name and area/city */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-fg">{party.partyName}</p>
          <p className="mt-0.5 text-[0.72rem] text-muted">
            {party.area && party.city
              ? `${party.area} · ${party.city}`
              : party.area || party.city || "No location"}
          </p>
        </div>
        {isPending && (
          <span
            className="mono shrink-0 rounded-full border px-2 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
            style={{
              color: "var(--color-amber)",
              borderColor: "var(--color-amber)",
            }}
            aria-label="Has outstanding amount"
          >
            Outstanding
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] tabular-nums text-muted">
        <span className="mono">
          Orders: <span className="text-fg">{party.totalOrders}</span>
        </span>
        <span className="mono">
          Sales: <span className="text-fg">{rupees(party.totalSaleValue)}</span>
        </span>
        <span className="mono">
          Outstanding:{" "}
          <span
            className={
              hasOutstanding ? "font-semibold text-[var(--color-amber)]" : "text-fg"
            }
          >
            {rupees(party.outstandingAmount)}
          </span>
        </span>
      </div>
    </li>
  );
}
