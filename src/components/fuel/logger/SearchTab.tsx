"use client";

import { useEffect, useRef, useState } from "react";
import { searchFoods } from "@/lib/fuel/api";
import { fetchRecentFoods, type RecentFood } from "@/lib/supabase/nutrition";
import { categoryStyle, type FoodSearchResult } from "@/lib/fuel/food";

interface SearchTabProps {
  onPick: (food: FoodSearchResult) => void;
}

/** Turns a recent-food row into a search result the selector understands. */
function recentToFood(r: RecentFood): FoodSearchResult {
  return {
    id: r.food_ref_id ?? "",
    name: r.food_name,
    brand: r.brand,
    food_group: null,
    source: r.food_source,
    badge: "Recent",
    badgeColor: "#6EE7B7",
    per100g: {
      calories: r.calories_per_100g,
      protein_g: r.protein_per_100g,
      fat_g: r.fat_per_100g,
      carbs_g: r.carbs_per_100g,
      fiber_g: r.fiber_per_100g,
    },
    canEdit: r.food_source === "indian" || r.food_source === "custom",
  };
}

export default function SearchTab({ onPick }: SearchTabProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchRecentFoods(10).then(setRecent);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const query = q.trim();
    debounce.current = setTimeout(
      async () => {
        if (query.length < 2) {
          setResults([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        const r = await searchFoods(query);
        setResults(r);
        setLoading(false);
      },
      query.length < 2 ? 0 : 400
    );
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const typing = q.trim().length >= 2;

  return (
    <div>
      <input
        type="text"
        value={q}
        autoFocus
        placeholder="Search food..."
        onChange={(e) => setQ(e.target.value)}
        className="w-full"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "0.75rem 0.9rem",
          color: "var(--color-fg)",
        }}
      />

      {!typing && recent.length > 0 && (
        <div className="mt-5">
          <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">Recent</p>
          <div className="mt-2 flex flex-col gap-2">
            {recent.map((r, i) => (
              <button
                key={`${r.food_name}-${i}`}
                type="button"
                onClick={() => onPick(recentToFood(r))}
                data-no-vitality
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left"
                style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
              >
                <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">{r.food_name}</span>
                <span className="mono ml-3 shrink-0 text-[0.72rem] text-muted">
                  {Math.round(r.calories_per_100g)} kcal/100g
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {typing && (
        <div className="mt-4 flex flex-col gap-2">
          {loading && <p className="text-[0.8rem] text-muted">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="text-[0.8rem] text-muted">No matches. Try Quick Add.</p>
          )}
          {results.map((f) => {
            const cat = categoryStyle(f.food_group);
            return (
              <button
                key={`${f.source}-${f.id}`}
                type="button"
                onClick={() => onPick(f)}
                data-no-vitality
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
              >
                <span
                  className="mono flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold"
                  style={{ background: `color-mix(in srgb, ${cat.color} 22%, transparent)`, color: cat.color, border: `1px solid ${cat.color}` }}
                >
                  {cat.abbr}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9rem] font-medium">{f.name}</span>
                  <span
                    className="mono mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.1em]"
                    style={{ color: f.badgeColor, border: `1px solid ${f.badgeColor}` }}
                  >
                    {f.badge}
                  </span>
                </span>
                <span className="mono shrink-0 text-[0.72rem] text-muted">
                  {Math.round(f.per100g.calories)} kcal/100g
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
