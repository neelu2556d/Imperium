/**
 * POST /api/food-edit
 * Body: { foodId, source, userId, overrides: { calories, protein_g, fat_g,
 *         carbs_g, fiber_g } }
 *
 * Persists corrected per-100g nutrition so it survives future searches:
 *   - source 'indian': stores the block on indian_foods.user_overrides
 *   - source 'custom': overwrites the custom_foods per-100g columns (RLS-scoped)
 *
 * External sources (usda/off/barcode/meal_scan) have no persistent row; the
 * caller edits those in-memory only and never hits this endpoint.
 */

import { createClient } from "@supabase/supabase-js";
import { safeNum } from "@/lib/fuel/food";

interface EditBody {
  foodId?: unknown;
  source?: unknown;
  userId?: unknown;
  overrides?: unknown;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: "Not configured." }, { status: 500 });
  }

  let body: EditBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }

  const foodId = typeof body.foodId === "string" ? body.foodId : "";
  const source = typeof body.source === "string" ? body.source : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const o = (body.overrides ?? {}) as Record<string, unknown>;
  if (!foodId || !source) {
    return Response.json({ error: "Missing foodId/source." }, { status: 400 });
  }

  const overrides = {
    calories: safeNum(o.calories),
    protein_g: safeNum(o.protein_g),
    fat_g: safeNum(o.fat_g),
    carbs_g: safeNum(o.carbs_g),
    fiber_g: safeNum(o.fiber_g),
  };

  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const supabase = createClient(supabaseUrl, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (source === "indian") {
    const { error } = await supabase
      .from("indian_foods")
      .update({ user_overrides: overrides })
      .eq("id", foodId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ ok: true, overrides });
  }

  if (source === "custom") {
    const q = supabase
      .from("custom_foods")
      .update({
        calories_per_100g: overrides.calories,
        protein_per_100g: overrides.protein_g,
        fat_per_100g: overrides.fat_g,
        carbs_per_100g: overrides.carbs_g,
        fiber_per_100g: overrides.fiber_g,
      })
      .eq("id", foodId);
    const { error } = userId ? await q.eq("user_id", userId) : await q;
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ ok: true, overrides });
  }

  return Response.json({ error: "Source not editable." }, { status: 400 });
}
