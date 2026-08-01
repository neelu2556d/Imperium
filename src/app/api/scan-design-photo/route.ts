/**
 * POST /api/scan-design-photo
 *
 * Takes a fabric-design photo (base64 data URL) and asks a Groq vision model to
 * read the design number printed on it (usually along the bottom edge) and the
 * dress-material item it belongs to. Returns:
 *
 *   { d_no, item_name }
 *
 * with null for anything the model couldn't find. Mirrors
 * /api/scan-lot-report: same model default + GROQ_VISION_MODEL override, same
 * tolerant JSON extraction. PDFs are rejected with a clear error — Groq's
 * vision endpoint only accepts images — so the client can drop to manual entry.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const PROMPT =
  "This is a photo of a dress-material fabric design. Read the design number " +
  "printed on it — usually a number or code along the bottom edge, often " +
  "prefixed like 'D.No:-'. Return JSON only: {d_no: string, item_name: " +
  "string}. item_name is the dress-material item the design belongs to if it " +
  "is visible or can be inferred, otherwise null. If the design number is not " +
  "found return null for d_no.";

interface ScanResult {
  d_no: string | null;
  item_name: string | null;
}

const toStrOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Parses the model response, tolerating stray prose or ```json fences. */
function extractResult(text: string): ScanResult | null {
  const trimmed = text.trim();

  const fromValue = (v: unknown): ScanResult | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const obj = v as Record<string, unknown>;
    return {
      d_no: toStrOrNull(obj.d_no),
      item_name: toStrOrNull(obj.item_name),
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
      { error: "Design scanning is not configured on this server." },
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
      { error: "Only photos can be scanned — please enter the design number manually." },
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
      { error: "The vision service couldn't read that photo." },
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
  if (!result || !result.d_no) {
    return Response.json(
      { error: "Couldn't find a design number in that photo." },
      { status: 422 }
    );
  }

  return Response.json(result);
}
