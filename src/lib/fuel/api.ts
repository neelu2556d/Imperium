"use client";

/**
 * Client wrappers for the Fuel food APIs. Each request forwards the browser's
 * Supabase access token so server-side reads/writes of the user's own rows
 * (custom_foods) satisfy row-level security.
 */

import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import type { FoodSearchResult, Per100g } from "@/lib/fuel/food";

/** The current session's access token (empty string if none yet). */
async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

function authHeaders(token: string): HeadersInit {
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

/** Searches all sources for `q`. Returns [] on any failure. */
export async function searchFoods(q: string): Promise<FoodSearchResult[]> {
  try {
    const userId = await ensureAnonymousSession();
    const token = await accessToken();
    const res = await fetch(
      `/api/food-search?q=${encodeURIComponent(q)}&userId=${encodeURIComponent(
        userId
      )}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export type BarcodeLookup =
  | { found: true; result: FoodSearchResult }
  | { found: false }
  | { error: true };

/** Looks up a scanned barcode against Open Food Facts. */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  try {
    const res = await fetch(
      `/api/food-barcode?barcode=${encodeURIComponent(barcode)}`
    );
    const data = await res.json().catch(() => null);
    if (!data) return { error: true };
    if (data.found && data.result) return { found: true, result: data.result };
    if (data.found === false) return { found: false };
    return { error: true };
  } catch {
    return { error: true };
  }
}

export type MealScanResult =
  | { items: FoodSearchResult[] }
  | { error: string };

/** Sends a base64 meal photo to the vision scanner. */
export async function scanMeal(imageDataUrl: string): Promise<MealScanResult> {
  try {
    const res = await fetch("/api/food-meal-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    const data = await res.json().catch(() => null);
    if (data && Array.isArray(data.items)) return { items: data.items };
    return { error: "Could not identify items" };
  } catch {
    return { error: "Could not identify items" };
  }
}

/** Persists a per-100g nutrition edit for an indian/custom food. */
export async function editFood(
  foodId: string,
  source: string,
  overrides: Per100g
): Promise<Per100g | null> {
  try {
    const userId = await ensureAnonymousSession();
    const token = await accessToken();
    const res = await fetch("/api/food-edit", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ foodId, source, userId, overrides }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.overrides ?? overrides;
  } catch {
    return null;
  }
}

/** Reverts a nutrition edit; returns the restored per-100g block (or null). */
export async function resetFood(
  foodId: string,
  source: string
): Promise<Per100g | null | "ok"> {
  try {
    const userId = await ensureAnonymousSession();
    const token = await accessToken();
    const res = await fetch("/api/food-edit/reset", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ foodId, source, userId }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // indian resets return overrides:null (base columns apply); signal "ok".
    if (data?.overrides == null) return "ok";
    return data.overrides as Per100g;
  } catch {
    return null;
  }
}

/**
 * Saves a Quick-Add food into custom_foods so it appears under "My Foods" in
 * future searches. Stores per-100g values plus an `original_values` snapshot
 * for later reset. Returns the new row id, or null on failure.
 */
export async function saveCustomFood(input: {
  name: string;
  brand?: string | null;
  per100g: Per100g;
  defaultServingG: number;
  defaultUnit: string;
}): Promise<string | null> {
  try {
    const userId = await ensureAnonymousSession();
    const original = {
      calories: input.per100g.calories,
      protein_g: input.per100g.protein_g,
      fat_g: input.per100g.fat_g,
      carbs_g: input.per100g.carbs_g,
      fiber_g: input.per100g.fiber_g,
    };
    const { data, error } = await supabase
      .from("custom_foods")
      .insert({
        user_id: userId,
        name: input.name.trim() || "Untitled",
        brand: input.brand ?? null,
        calories_per_100g: input.per100g.calories,
        protein_per_100g: input.per100g.protein_g,
        fat_per_100g: input.per100g.fat_g,
        carbs_per_100g: input.per100g.carbs_g,
        fiber_per_100g: input.per100g.fiber_g,
        default_serving_g: input.defaultServingG,
        default_unit: input.defaultUnit,
        source: "quick_add",
        original_values: original,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return null;
    return String(data.id);
  } catch {
    return null;
  }
}
