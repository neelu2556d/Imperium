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
  "This is a photo of a dress-material swatch card. The top of the card is " +
  "only a brand header — lines like 'K.G.SONS' and 'Exclusive Dress Material' " +
  "— IGNORE those. The two fields I need are printed below the header: " +
  "(1) the ITEM NAME, e.g. 'Two-Tone 3 Pcs', 'Magic 3 Pcs', 'Capsule 2 Pcs' " +
  "(typically 'Something X Pcs'); and (2) the DESIGN NUMBER, e.g. 'D.NO:-532', " +
  "'D.NO: 545', 'D.No 689'. Return JSON only: {item_name: string, d_no: string}. " +
  "item_name is the dress-material item line verbatim (drop nothing, e.g. keep " +
  "'3 Pcs'), or null if it can't be read. d_no is just the number without any " +
  "prefix (e.g. '532', '545'), or null if it can't be read. Never return the " +
  "brand header as either field.";

interface ScanResult {
  d_no: string | null;
  item_name: string | null;
}

const toStrOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Reduces a read design number to its bare value: strips a 'D.NO', 'D.No',
 *  'No.' style prefix and stray punctuation so 'D.NO:-532' → '532' (TT-247
 *  stays 'TT-247'). Mirrors the tolerance the catalogue's numeric sort already
 *  has, so the badge shows one clean number. */
function normalizeDNo(v: unknown): string | null {
  const s = toStrOrNull(v);
  if (!s) return null;
  return s
    .replace(/^d\s*\.?\s*n[o0]\.?\s*[:#\-–—\s]*/i, "")
    .replace(/^no\.?\s*[:#\-–—\s]*/i, "")
    .replace(/^no\s*\d*[:#\-–—\s]*/i, "")
    .trim();
}

/** Parses the model response, tolerating stray prose or ```json fences. */
function extractResult(text: string): ScanResult | null {
  const trimmed = text.trim();

  const fromValue = (v: unknown): ScanResult | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const obj = v as Record<string, unknown>;
    return {
      d_no: normalizeDNo(obj.d_no),
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
