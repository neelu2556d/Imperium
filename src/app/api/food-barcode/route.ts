/**
 * GET /api/food-barcode?barcode=
 *
 * Looks up a scanned product barcode against Open Food Facts and returns it in
 * the standard {@link FoodSearchResult} shape (source 'barcode', editable).
 *   - product found        → { found: true, result }
 *   - product not in OFF    → { found: false }
 *   - OFF unreachable/error → { error: true }
 */

import { safeNum, type FoodSearchResult } from "@/lib/fuel/food";

const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = (searchParams.get("barcode") ?? "").trim();
  if (!barcode) return Response.json({ error: true }, { status: 400 });

  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
    barcode
  )}.json`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch {
    return Response.json({ error: true });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) return Response.json({ error: true });

  const payload = await res.json().catch(() => null);
  if (!payload) return Response.json({ error: true });

  // OFF returns status 1 when the product exists, 0 when not found.
  if (payload.status !== 1 || !payload.product) {
    return Response.json({ found: false });
  }

  const p = payload.product as Record<string, unknown>;
  const name =
    typeof p.product_name === "string" && p.product_name.trim()
      ? p.product_name.trim()
      : "";
  if (!name) return Response.json({ found: false });

  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const result: FoodSearchResult = {
    id: `barcode-${barcode}`,
    name,
    brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
    food_group: "Packaged",
    source: "barcode",
    badge: "Barcode",
    badgeColor: "#A78BFA",
    per100g: {
      calories: safeNum(n["energy-kcal_100g"]),
      protein_g: safeNum(n["proteins_100g"]),
      fat_g: safeNum(n["fat_100g"]),
      carbs_g: safeNum(n["carbohydrates_100g"]),
      fiber_g: safeNum(n["fiber_100g"]),
    },
    canEdit: true,
  };

  return Response.json({ found: true, result });
}
