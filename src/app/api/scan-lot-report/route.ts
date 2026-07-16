/**
 * POST /api/scan-lot-report
 *
 * Takes a lot-report photo (base64 data URL) and asks a Groq vision model to
 * extract the minimum metre figures for the three components. Returns:
 *
 *   { top_metres, bottom_metres, dupatta_metres, item_name, d_no }
 *
 * with null for anything the model couldn't find. Mirrors
 * /api/parse-nutrition-screenshot: same model default + GROQ_VISION_MODEL
 * override, same tolerant JSON extraction. PDFs are rejected with a clear
 * error — Groq's vision endpoint only accepts images — so the client can drop
 * to manual entry.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const PROMPT =
  "Extract the minimum metre figures for Top, Bottom, and Dupatta from this " +
  "lot report. Return JSON only: {top_metres: number, bottom_metres: number, " +
  "dupatta_metres: number, item_name: string, d_no: string}. If a field is " +
  "not found return null.";

interface ScanResult {
  top_metres: number | null;
  bottom_metres: number | null;
  dupatta_metres: number | null;
  item_name: string | null;
  d_no: string | null;
}

const toNumOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const toStrOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Parses the model response, tolerating stray prose or ```json fences. */
function extractResult(text: string): ScanResult | null {
  const trimmed = text.trim();

  const fromValue = (v: unknown): ScanResult | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const obj = v as Record<string, unknown>;
    return {
      top_metres: toNumOrNull(obj.top_metres),
      bottom_metres: toNumOrNull(obj.bottom_metres),
      dupatta_metres: toNumOrNull(obj.dupatta_metres),
      item_name: toStrOrNull(obj.item_name),
      d_no: toStrOrNull(obj.d_no),
    };
  };

  try {
    const direct = fromValue(JSON.parse(trimmed));
    if (direct) return direct;
  } catch {
    // fall through to substring extraction
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return fromValue(JSON.parse(trimmed.slice(start, end + 1)));
    } catch {
      // ignore
    }
  }
  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Lot report scanning is not configured on this server." },
      { status: 500 }
    );
  }

  let image: unknown;
  try {
    ({ image } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof image !== "string" || !image.startsWith("data:")) {
    return Response.json(
      { error: "Expected an `image` base64 data URL." },
      { status: 400 }
    );
  }
  if (!image.startsWith("data:image/")) {
    return Response.json(
      { error: "Only photos can be scanned — please enter the report manually." },
      { status: 415 }
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
        max_tokens: 512,
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
      { error: "The vision service couldn't read that report." },
      { status: 502 }
    );
  }

  const payload = await groqRes.json().catch(() => null);
  const content: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return Response.json(
      { error: "No readable result came back. Try entering manually." },
      { status: 422 }
    );
  }

  const result = extractResult(content);
  if (
    !result ||
    (result.top_metres == null &&
      result.bottom_metres == null &&
      result.dupatta_metres == null)
  ) {
    return Response.json(
      { error: "Couldn't find any metre figures in that report." },
      { status: 422 }
    );
  }

  return Response.json(result);
}
