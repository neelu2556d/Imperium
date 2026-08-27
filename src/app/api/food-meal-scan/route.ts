/**
 * POST /api/food-meal-scan   body: { image: <base64 data URL> }
 *
 * Sends a meal photo to a Groq vision model and asks it to identify every food
 * item with a gram estimate and per-100g macros. Returns the items in the
 * standard {@link FoodSearchResult} shape (source 'meal_scan', editable) plus
 * `estimated_grams` per item:
 *   { items: [...] }               on success
 *   { error: 'Could not identify items' }   on any failure
 *
 * The spec names `llama-3.2-11b-vision-preview`, but Groq decommissioned the
 * llama-3.2 vision previews. We reuse the app's current default multimodal
 * model (with the same GROQ_VISION_MODEL override as the other scan routes).
 */

import { safeNum, type FoodSearchResult } from "@/lib/fuel/food";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT =
  "You are a nutrition expert specializing in Indian food. Identify all food " +
  "items in this image. For each item, estimate the quantity in grams based " +
  "on typical serving sizes. Return ONLY a JSON array, no other text:\n" +
  "[{\n" +
  '  "name": string,\n' +
  '  "estimated_grams": number,\n' +
  '  "per_100g": {\n' +
  '    "calories": number,\n' +
  '    "protein_g": number,\n' +
  '    "fat_g": number,\n' +
  '    "carbs_g": number,\n' +
  '    "fiber_g": number\n' +
  "  }\n" +
  "}]\n" +
  "Use specific Indian food names (e.g. Dal Tadka, Basmati Rice cooked, Roti " +
  "whole wheat). Skip items you cannot identify clearly.";

const FAIL = { error: "Could not identify items" };

/** Slices a JSON array out of the model text, tolerating fences/prose. */
function extractArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  try {
    const direct = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object") {
      const arr = Object.values(direct).find((v) => Array.isArray(v));
      if (arr) return arr as unknown[];
    }
  } catch {
    // fall through
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(arr)) return arr;
    } catch {
      // ignore
    }
  }
  return null;
}

function normalise(raw: unknown[]): FoodSearchResult[] {
  const out: FoodSearchResult[] = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const item = r as Record<string, unknown>;
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "";
    if (!name) return;
    const p = (item.per_100g ?? {}) as Record<string, unknown>;
    out.push({
      id: `scan-${i}-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      brand: null,
      food_group: null,
      source: "meal_scan",
      badge: "AI Scan",
      badgeColor: "#A78BFA",
      per100g: {
        calories: safeNum(p.calories),
        protein_g: safeNum(p.protein_g),
        fat_g: safeNum(p.fat_g),
        carbs_g: safeNum(p.carbs_g),
        fiber_g: safeNum(p.fiber_g),
      },
      canEdit: true,
      estimated_grams: safeNum(item.estimated_grams) || 100,
    });
  });
  return out;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json(FAIL, { status: 500 });

  let image: unknown;
  try {
    ({ image } = await request.json());
  } catch {
    return Response.json(FAIL, { status: 400 });
  }
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json(FAIL, { status: 400 });
  }

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL || DEFAULT_MODEL,
        temperature: 0,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
  } catch {
    return Response.json(FAIL, { status: 502 });
  }

  if (!groqRes.ok) return Response.json(FAIL, { status: 502 });

  const payload = await groqRes.json().catch(() => null);
  const content: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return Response.json(FAIL, { status: 422 });

  const arr = extractArray(content);
  if (!arr) return Response.json(FAIL, { status: 422 });

  const items = normalise(arr);
  if (items.length === 0) return Response.json(FAIL, { status: 422 });

  return Response.json({ items });
}
