/**
 * GET /api/food-search?q=&userId=
 *
 * Searches four sources in parallel and merges them into one normalised list
 * (see {@link FoodSearchResult}): the user's saved foods, the Indian food DB,
 * USDA FoodData Central, and Open Food Facts (packaged goods). Results are
 * merged custom → indian → USDA → OFF, de-duplicated by name, capped at 20.
 *
 * Auth: custom_foods is RLS-scoped, so the browser forwards its Supabase access
 * token in the Authorization header; we bind a server client to it so the
 * user's saved foods come back (and only theirs). The other three sources are
 * public. Any single source failing (or timing out) is swallowed — the search
 * still returns whatever the others found.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  safeNum,
  type FoodSearchResult,
  type Per100g,
} from "@/lib/fuel/food";

const MAX_RESULTS = 20;
const EXTERNAL_TIMEOUT_MS = 5000;

/** fetch with an AbortController timeout; resolves null on error/timeout. */
async function timedFetch(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a per-100g override stored on an indian_foods row, if present. */
function overridePer100g(
  overrides: unknown,
  base: Per100g
): Per100g {
  if (!overrides || typeof overrides !== "object") return base;
  const o = overrides as Record<string, unknown>;
  return {
    calories: o.calories != null ? safeNum(o.calories) : base.calories,
    protein_g: o.protein_g != null ? safeNum(o.protein_g) : base.protein_g,
    fat_g: o.fat_g != null ? safeNum(o.fat_g) : base.fat_g,
    carbs_g: o.carbs_g != null ? safeNum(o.carbs_g) : base.carbs_g,
    fiber_g: o.fiber_g != null ? safeNum(o.fiber_g) : base.fiber_g,
  };
}

/* --------------------------------- sources --------------------------------- */

type Row = Record<string, unknown>;

async function searchIndian(
  supabase: SupabaseClient,
  q: string
): Promise<FoodSearchResult[]> {
  const { data, error } = await supabase
    .from("indian_foods")
    .select(
      "id, name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, user_overrides"
    )
    .ilike("name", `%${q}%`)
    .limit(6);
  if (error || !data) return [];
  return (data as Row[]).map((r) => {
    const base: Per100g = {
      calories: safeNum(r.calories_per_100g),
      protein_g: safeNum(r.protein_per_100g),
      fat_g: safeNum(r.fat_per_100g),
      carbs_g: safeNum(r.carbs_per_100g),
      fiber_g: safeNum(r.fiber_per_100g),
    };
    return {
      id: String(r.id),
      name: String(r.name),
      brand: null,
      food_group: r.category == null ? null : String(r.category),
      source: "indian",
      badge: "Indian DB",
      badgeColor: "#FF9933",
      per100g: overridePer100g(r.user_overrides, base),
      canEdit: true,
    } satisfies FoodSearchResult;
  });
}

async function searchCustom(
  supabase: SupabaseClient,
  q: string,
  userId: string
): Promise<FoodSearchResult[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("custom_foods")
    .select(
      "id, name, brand, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g"
    )
    .eq("user_id", userId)
    .ilike("name", `%${q}%`)
    .limit(4);
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    brand: r.brand == null ? null : String(r.brand),
    food_group: null,
    source: "custom",
    badge: "My Foods",
    badgeColor: "#6EE7B7",
    per100g: {
      calories: safeNum(r.calories_per_100g),
      protein_g: safeNum(r.protein_per_100g),
      fat_g: safeNum(r.fat_per_100g),
      carbs_g: safeNum(r.carbs_per_100g),
      fiber_g: safeNum(r.fiber_per_100g),
    },
    canEdit: true,
  }));
}

async function searchUsda(q: string): Promise<FoodSearchResult[]> {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const url =
    "https://api.nal.usda.gov/fdc/v1/foods/search" +
    `?query=${encodeURIComponent(q)}&pageSize=5&api_key=${apiKey}`;
  const res = await timedFetch(url, EXTERNAL_TIMEOUT_MS);
  if (!res || !res.ok) return [];
  const payload = await res.json().catch(() => null);
  const foods: Row[] = Array.isArray(payload?.foods) ? payload.foods : [];

  const nutrient = (nutrients: Row[], ids: number[]): number => {
    for (const n of nutrients) {
      const id = safeNum(n.nutrientId);
      if (ids.includes(id)) return safeNum(n.value);
    }
    return 0;
  };

  return foods.slice(0, 5).map((f) => {
    const nutrients: Row[] = Array.isArray(f.foodNutrients)
      ? (f.foodNutrients as Row[])
      : [];
    return {
      id: `usda-${String(f.fdcId)}`,
      name: String(f.description ?? "Unknown"),
      brand: f.brandOwner ? String(f.brandOwner) : null,
      food_group: f.foodCategory ? String(f.foodCategory) : null,
      source: "usda",
      badge: "USDA",
      badgeColor: "#60A5FA",
      per100g: {
        calories: nutrient(nutrients, [1008, 2047, 2048]),
        protein_g: nutrient(nutrients, [1003]),
        fat_g: nutrient(nutrients, [1004]),
        carbs_g: nutrient(nutrients, [1005]),
        fiber_g: nutrient(nutrients, [1079]),
      },
      canEdit: false,
    } satisfies FoodSearchResult;
  });
}

async function searchOff(q: string): Promise<FoodSearchResult[]> {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl" +
    `?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process` +
    "&json=1&page_size=5" +
    "&fields=code,product_name,brands,nutriments";
  const res = await timedFetch(url, EXTERNAL_TIMEOUT_MS);
  if (!res || !res.ok) return [];
  const payload = await res.json().catch(() => null);
  const products: Row[] = Array.isArray(payload?.products)
    ? payload.products
    : [];

  const out: FoodSearchResult[] = [];
  for (const p of products) {
    const name = typeof p.product_name === "string" ? p.product_name.trim() : "";
    if (!name) continue;
    const n = (p.nutriments ?? {}) as Row;
    out.push({
      id: `off-${String(p.code ?? name)}`,
      name,
      brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
      food_group: "Packaged",
      source: "off",
      badge: "Packaged",
      badgeColor: "#A78BFA",
      per100g: {
        calories: safeNum(n["energy-kcal_100g"]),
        protein_g: safeNum(n["proteins_100g"]),
        fat_g: safeNum(n["fat_100g"]),
        carbs_g: safeNum(n["carbohydrates_100g"]),
        fiber_g: safeNum(n["fiber_100g"]),
      },
      canEdit: true,
    });
    if (out.length >= 5) break;
  }
  return out;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json({ results: [] });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const userId = (searchParams.get("userId") ?? "").trim();
  if (q.length < 2) return Response.json({ results: [] });

  // Bind to the caller's session so RLS lets their custom_foods through.
  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const supabase: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [custom, indian, usda, off] = await Promise.all([
    searchCustom(supabase, q, userId).catch(() => []),
    searchIndian(supabase, q).catch(() => []),
    searchUsda(q).catch(() => []),
    searchOff(q).catch(() => []),
  ]);

  // Merge in priority order, de-duplicating by case-insensitive name.
  const seen = new Set<string>();
  const results: FoodSearchResult[] = [];
  for (const group of [custom, indian, usda, off]) {
    for (const item of group) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= MAX_RESULTS) break;
    }
    if (results.length >= MAX_RESULTS) break;
  }

  return Response.json({ results });
}
