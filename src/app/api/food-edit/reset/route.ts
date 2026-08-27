/**
 * POST /api/food-edit/reset
 * Body: { foodId, source, userId }
 *
 * Reverts a prior nutrition edit back to the food's original values:
 *   - source 'indian': clears indian_foods.user_overrides (→ NULL), so the
 *     seeded per-100g columns apply again.
 *   - source 'custom': restores the per-100g columns from the row's
 *     original_values snapshot (written when the food was first saved).
 *
 * Returns { ok: true, overrides } where `overrides` is the restored per-100g
 * block (null for 'indian', since the base columns are authoritative there).
 */

import { createClient } from "@supabase/supabase-js";
import { safeNum } from "@/lib/fuel/food";

interface ResetBody {
  foodId?: unknown;
  source?: unknown;
  userId?: unknown;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: "Not configured." }, { status: 500 });
  }

  let body: ResetBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }

  const foodId = typeof body.foodId === "string" ? body.foodId : "";
  const source = typeof body.source === "string" ? body.source : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!foodId || !source) {
    return Response.json({ error: "Missing foodId/source." }, { status: 400 });
  }

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
      .update({ user_overrides: null })
      .eq("id", foodId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ ok: true, overrides: null });
  }

  if (source === "custom") {
    // Read the original snapshot, then write it back onto the live columns.
    const readQ = supabase
      .from("custom_foods")
      .select("original_values")
      .eq("id", foodId);
    const { data, error: readErr } = await (userId
      ? readQ.eq("user_id", userId)
      : readQ
    ).maybeSingle();
    if (readErr) return Response.json({ error: readErr.message }, { status: 502 });

    const orig = (data?.original_values ?? null) as Record<string, unknown> | null;
    if (!orig) {
      return Response.json({ error: "No original values stored." }, { status: 404 });
    }
    const overrides = {
      calories: safeNum(orig.calories),
      protein_g: safeNum(orig.protein_g),
      fat_g: safeNum(orig.fat_g),
      carbs_g: safeNum(orig.carbs_g),
      fiber_g: safeNum(orig.fiber_g),
    };
    const writeQ = supabase
      .from("custom_foods")
      .update({
        calories_per_100g: overrides.calories,
        protein_per_100g: overrides.protein_g,
        fat_per_100g: overrides.fat_g,
        carbs_per_100g: overrides.carbs_g,
        fiber_per_100g: overrides.fiber_g,
      })
      .eq("id", foodId);
    const { error: writeErr } = userId
      ? await writeQ.eq("user_id", userId)
      : await writeQ;
    if (writeErr) return Response.json({ error: writeErr.message }, { status: 502 });
    return Response.json({ ok: true, overrides });
  }

  return Response.json({ error: "Source not editable." }, { status: 400 });
}
