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
  "You are reading a nutrition-app screenshot. Extract every food item with " +
  "its calories and macros (protein, fat, carbs in grams). Screenshots often " +
  "show calories per item but only ONE combined macro total for the whole " +
  "meal. In that case still fill in each item's calories, and read the meal's " +
  "TOTAL protein/fat/carbs into the `total` field. If a food's macros are not " +
  "shown individually, estimate them from the item name and its calories " +
  "(protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g). Never leave every macro " +
  "at 0. Respond with ONLY this JSON object, nothing else:\n" +
  '{"items":[{"item_name":"","calories":0,"protein_g":0,"fat_g":0,' +
  '"carbs_g":0}],"total":{"calories":0,"protein_g":0,"fat_g":0,"carbs_g":0}}';

interface ParsedItem {
  item_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

interface MacroTotal {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

interface Extracted {
  items: unknown[];
  /** The meal-wide macro total, when the model reported one. */
  total: Record<string, unknown> | null;
}

/** Parses the model response into an items array plus an optional meal total,
 *  tolerating stray prose or ```json fences. The model is asked for an object
 *  `{items, total}`, but we also accept a bare array for backwards safety.
 *  Returns null if nothing item-shaped is found. */
function extractResult(text: string): Extracted | null {
  const trimmed = text.trim();

  const fromValue = (v: unknown): Extracted | null => {
    if (Array.isArray(v)) return { items: v, total: null };
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const arr = Array.isArray(obj.items)
        ? obj.items
        : (Object.values(obj).find((x) => Array.isArray(x)) as
            | unknown[]
            | undefined);
      if (arr) {
        const total =
          obj.total && typeof obj.total === "object"
            ? (obj.total as Record<string, unknown>)
            : null;
        return { items: arr, total };
      }
    }
    return null;
  };

  try {
    const direct = fromValue(JSON.parse(trimmed));
    if (direct) return direct;
  } catch {
    // fall through to substring extraction
  }

  // Try to slice out an object first, then a bare array.
  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      const parsed = fromValue(JSON.parse(trimmed.slice(objStart, objEnd + 1)));
      if (parsed) return parsed;
    } catch {
      // ignore
    }
  }
  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      const arr = JSON.parse(trimmed.slice(arrStart, arrEnd + 1));
      if (Array.isArray(arr)) return { items: arr, total: null };
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

const MACRO_KEYS = ["protein_g", "fat_g", "carbs_g"] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

/**
 * When the screenshot only carried a single meal-wide macro total (per-item
 * macros all came back as 0), spread that total across the items in proportion
 * to each item's calories so nothing is logged as 0/0/0. Any per-item macros
 * the model *did* provide are left untouched.
 */
function applyMealTotal(
  items: ParsedItem[],
  total: MacroTotal | null
): ParsedItem[] {
  if (!total || items.length === 0) return items;

  const totalCalories = items.reduce((sum, it) => sum + it.calories, 0);

  for (const key of MACRO_KEYS) {
    const target = total[key];
    if (target <= 0) continue;

    // Only distribute macros the items don't already account for.
    const alreadyAssigned = items.reduce((sum, it) => sum + it[key], 0);
    if (alreadyAssigned > 0) continue;

    let assigned = 0;
    items.forEach((it, i) => {
      const isLast = i === items.length - 1;
      // Give the remainder to the last item so the parts sum to the total.
      const share = isLast
        ? target - assigned
        : totalCalories > 0
          ? Math.round((it.calories / totalCalories) * target)
          : Math.round(target / items.length);
      it[key] = Math.max(0, share);
      assigned += it[key];
    });
  }

  return items;
}

function normaliseTotal(raw: Record<string, unknown> | null): MacroTotal | null {
  if (!raw) return null;
  const total: MacroTotal = {
    calories: toNum(raw.calories),
    protein_g: toNum(raw.protein_g),
    fat_g: toNum(raw.fat_g),
    carbs_g: toNum(raw.carbs_g),
  };
  const hasMacros = MACRO_KEYS.some((k) => total[k as MacroKey] > 0);
  return hasMacros ? total : null;
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

  const extracted = extractResult(content);
  if (!extracted) {
    return Response.json(
      { error: "Couldn't find any food items in that screenshot." },
      { status: 422 }
    );
  }

  const items = applyMealTotal(
    normalise(extracted.items),
    normaliseTotal(extracted.total)
  );
  if (items.length === 0) {
    return Response.json(
      { error: "Couldn't find any food items in that screenshot." },
      { status: 422 }
    );
  }

  return Response.json({ items });
}
