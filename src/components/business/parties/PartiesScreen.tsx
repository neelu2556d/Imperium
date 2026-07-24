
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import PartyCard from "./PartyCard";
import NewPartySheet from "./NewPartySheet";
import { fetchAllParties } from "@/lib/supabase/parties";
import type { PartyRow } from "@/lib/supabase/parties";

/**
 * The Parties screen: heading + "+ Add Party", search box, and party cards list.
 * Tapping a card routes to /business/parties/[party_id]; "+ Add Party" opens
 * the bottom sheet for adding a new party.
 */
export default function PartiesScreen() {
  const router = useRouter();
  const [parties, setParties] = useState<PartyRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    fetchAllParties().then(setParties);
  }, []);

  useEffect(load, [load]);

  const visible = parties?.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.partyName.toLowerCase().includes(q) ||
      p.area?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      {/* Top bar: "Parties" heading + Add button */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Parties
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={15} aria-hidden />
          Add Party
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mt-3">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search party, area, or city"
          className="w-full pl-9"
          data-no-vitality
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: "var(--radius-sm)",
          }}
        />
      </div>

      {/* Loading state */}
      {visible === null ? (
        <ul className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {parties && parties.length === 0
            ? "No parties yet. Add your first with + Add Party."
            : "No parties match your search."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((party) => (
            <PartyCard key={party.id} party={party} />
          ))}
        </ul>
      )}

      {/* Add party bottom sheet */}
      {sheetOpen && (
        <NewPartySheet
          onClose={() => setSheetOpen(false)}
          onSaved={(partyId) => {
            setSheetOpen(false);
            router.push(`/business/parties/${partyId}`);
          }}
        />
      )}
    </div>
  );
}
