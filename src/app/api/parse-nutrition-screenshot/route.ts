/**
 * POST /api/parse-nutrition-screenshot
 *
 * Takes a nutrition-app screenshot (base64 data URL) and asks a Groq
 * vision-capable model to extract the food items and their macros. Returns a
 * normalised JSON array the Fuel tab can drop straight into a confirmation
 * screen:
 *
 *   { items: [{ item_name, calories, protein_g, fat_g, carbs_g }, ...] }
 *
 * The spec names `llama-3.2-11b-vision-preview`, but Groq has since
 * decommissioned the llama-3.2 vision preview models. We default to their
 * current multimodal model and allow an override via GROQ_VISION_MODEL so the
 * choice can be swapped without a code change.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const PROMPT =
  "Extract all food items, calories, and macros from this nutrition app " +
  "screenshot. Return a JSON array: [{item_name, calories, protein_g, " +
  "fat_g, carbs_g}]. Only return the JSON array, nothing else.";

interface ParsedItem {
  item_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Pulls the first JSON array out of a model response, tolerating stray prose
 *  or ```json fences around it. Returns null if nothing array-shaped is found. */
function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  try {
    const direct = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
    // Some models wrap the array in an object, e.g. { "items": [...] }.
    if (direct && typeof direct === "object") {
      const arr = Object.values(direct).find((v) => Array.isArray(v));
      if (arr) return arr as unknown[];
    }
  } catch {
    // fall through to substring extraction
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

function normalise(raw: unknown[]): ParsedItem[] {
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      item_name:
        typeof r.item_name === "string" && r.item_name.trim()
          ? r.item_name.trim()
          : "Untitled item",
      calories: toNum(r.calories),
      protein_g: toNum(r.protein_g),
      fat_g: toNum(r.fat_g),
      carbs_g: toNum(r.carbs_g),
    }));
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Screenshot import is not configured on this server." },
      { status: 500 }
    );
  }

  let image: unknown;
  try {
    ({ image } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json(
      { error: "Expected an `image` base64 data URL." },
      { status: 400 }
    );
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
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach the vision service. Try again." },
      { status: 502 }
    );
  }

  if (!groqRes.ok) {
    return Response.json(
      { error: "The vision service couldn't read that screenshot." },
      { status: 502 }
    );
  }

  const payload = await groqRes.json().catch(() => null);
  const content: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return Response.json(
      { error: "No readable result came back. Try logging manually." },
      { status: 422 }
    );
  }

  const arr = extractJsonArray(content);
  if (!arr) {
    return Response.json(
      { error: "Couldn't find any food items in that screenshot." },
      { status: 422 }
    );
  }

  const items = normalise(arr);
  if (items.length === 0) {
    return Response.json(
      { error: "Couldn't find any food items in that screenshot." },
      { status: 422 }
    );
  }

  return Response.json({ items });
}
