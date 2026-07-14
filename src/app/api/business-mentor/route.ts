/**
 * POST /api/business-mentor
 *
 * The brain behind the Business tab's coach. Given a `contextType` it:
 *   1. Gathers the owner's real trading context from Supabase (sales this month
 *      vs last, outstanding receivables, lot health, overdue collections) —
 *      scoped to the caller via their forwarded access token, so RLS returns
 *      their own rows.
 *   2. Builds a system prompt for a no-nonsense wholesale-business mentor.
 *   3. Calls Groq's OpenAI-compatible chat completions.
 *   4. Persists the generated briefing to business_mentor_messages, stamped with
 *      the context snapshot that shaped it.
 *
 * Mirrors /api/mentor (the fitness coach) but reads the business tables and
 * keeps its own message thread. The Groq key stays server-side (GROQ_API_KEY).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

type ContextType = "morning_briefing" | "pre_visit" | "post_day" | "chat";
const CONTEXT_TYPES: ContextType[] = [
  "morning_briefing",
  "pre_visit",
  "post_day",
  "chat",
];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round = (n: number): number => Math.round(n);

/** ₹ formatting for the prompt — plain integers, no locale surprises. */
const rupees = (n: number): string => `₹${round(n).toLocaleString("en-IN")}`;

/** Local YYYY-MM-DD, matching how the business tables store dates. */
function localISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole-day difference (today − date), floored, never negative. */
function daysBetween(from: string, to: Date): number {
  const d = new Date(`${from}T00:00:00`);
  const ms = to.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

interface OverdueLine {
  partyName: string;
  amount: number;
  daysOverdue: number;
}

interface BusinessContext {
  salesThisMonth: number;
  salesLastMonth: number;
  salesDelta: number;
  outstanding: number;
  invoiceCount: number;
  activeLots: number;
  lowStockLots: number;
  deadStockLots: number;
  ordersThisMonth: number;
  partiesVisited: number;
  overdueTotal: number;
  overdueCount: number;
  topOverdue: OverdueLine[];
}

/**
 * Pulls every slice of business context the briefing needs, in parallel. Each
 * read is defensive: a brand-new owner (or an empty table) resolves to zero
 * rather than failing the whole request.
 */
async function gatherContext(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessContext> {
  const now = new Date();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const salesP = supabase
    .from("orders")
    .select("total_amount, order_date")
    .eq("user_id", userId)
    .gte("order_date", localISODate(lastStart))
    .lt("order_date", localISODate(nextStart));

  const outstandingP = supabase
    .from("orders")
    .select("net_payable, amount_received")
    .eq("user_id", userId)
    .in("payment_status", ["pending", "overdue"]);

  const lotsP = supabase.from("lots").select("status").eq("user_id", userId);

  const ordersMonthP = supabase
    .from("orders")
    .select("party_id")
    .eq("user_id", userId)
    .gte("order_date", localISODate(thisStart))
    .lt("order_date", localISODate(nextStart));

  const overdueP = supabase
    .from("orders")
    .select("party_name, net_payable, amount_received, due_date")
    .eq("user_id", userId)
    .eq("payment_status", "overdue")
    .order("due_date", { ascending: true });

  const [salesR, outstandingR, lotsR, ordersMonthR, overdueR] =
    await Promise.all([salesP, outstandingP, lotsP, ordersMonthP, overdueP]);

  // Sales — this month vs last, split off order_date.
  const thisFrom = localISODate(thisStart);
  let salesThisMonth = 0;
  let salesLastMonth = 0;
  for (const row of salesR.data ?? []) {
    const amount = num(row.total_amount);
    if (String(row.order_date) >= thisFrom) salesThisMonth += amount;
    else salesLastMonth += amount;
  }

  // Outstanding receivables across pending + overdue invoices.
  const outstandingRows = outstandingR.data ?? [];
  const outstanding = outstandingRows.reduce(
    (sum, r) => sum + (num(r.net_payable) - num(r.amount_received)),
    0
  );

  // Lot health counts.
  let activeLots = 0;
  let lowStockLots = 0;
  let deadStockLots = 0;
  for (const row of lotsR.data ?? []) {
    const s = String(row.status);
    if (s === "active" || s === "low_stock") activeLots += 1;
    if (s === "low_stock") lowStockLots += 1;
    if (s === "dead_stock") deadStockLots += 1;
  }

  // Orders this month + unique parties.
  const ordersRows = ordersMonthR.data ?? [];
  const parties = new Set(
    ordersRows.map((r) => r.party_id).filter((id): id is string => Boolean(id))
  );

  // Overdue collections — total, count, and the three most overdue lines.
  const overdueRows = overdueR.data ?? [];
  const overdueTotal = overdueRows.reduce(
    (sum, r) => sum + (num(r.net_payable) - num(r.amount_received)),
    0
  );
  const topOverdue: OverdueLine[] = overdueRows.slice(0, 3).map((r) => ({
    partyName: String(r.party_name ?? "Unknown party"),
    amount: num(r.net_payable) - num(r.amount_received),
    daysOverdue: r.due_date ? daysBetween(String(r.due_date), now) : 0,
  }));

  return {
    salesThisMonth,
    salesLastMonth,
    salesDelta: salesThisMonth - salesLastMonth,
    outstanding,
    invoiceCount: outstandingRows.length,
    activeLots,
    lowStockLots,
    deadStockLots,
    ordersThisMonth: ordersRows.length,
    partiesVisited: parties.size,
    overdueTotal,
    overdueCount: overdueRows.length,
    topOverdue,
  };
}

/** Assembles the mentor system prompt from the gathered business context. */
function buildSystemPrompt(ctx: BusinessContext): string {
  const overdueLines = ctx.topOverdue.length
    ? ctx.topOverdue
        .map(
          (o) =>
            `${o.partyName} owes ${rupees(o.amount)} (${o.daysOverdue} days overdue)`
        )
        .join("; ")
    : "none flagged";

  return (
    `You are the Imperium Business mentor for a dress-material wholesale ` +
    `operation. You are sharp, practical, and speak like a seasoned trading ` +
    `partner — no fluff, no corporate jargon. Today's numbers: ` +
    `Sales this month ${rupees(ctx.salesThisMonth)} vs ${rupees(ctx.salesLastMonth)} ` +
    `last month (${ctx.salesDelta >= 0 ? "up" : "down"} ${rupees(Math.abs(ctx.salesDelta))}). ` +
    `Outstanding receivables ${rupees(ctx.outstanding)} across ${ctx.invoiceCount} invoices. ` +
    `Overdue collections ${rupees(ctx.overdueTotal)} across ${ctx.overdueCount} parties ` +
    `(most pressing: ${overdueLines}). ` +
    `Lots: ${ctx.activeLots} active, ${ctx.lowStockLots} low on stock, ${ctx.deadStockLots} dead stock. ` +
    `Orders this month: ${ctx.ordersThisMonth} across ${ctx.partiesVisited} parties. ` +
    `Write a morning briefing: 3-4 short, punchy lines. Lead with what needs ` +
    `action today (chase overdue money, move dead stock, restock what's low). ` +
    `Reference the actual numbers. Keep it under 120 words. No greetings, no sign-off.`
  );
}

const BRIEFING_INSTRUCTION: Record<ContextType, string> = {
  morning_briefing:
    "Give me my morning briefing — what should I focus on today?",
  pre_visit: "Brief me before my party visits today.",
  post_day: "Wrap up my trading day — how did it go and what's next?",
  chat: "Give me a quick read on where the business stands right now.",
};

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey || !supabaseUrl || !anonKey) {
    return Response.json(
      { error: "The business mentor is not configured on this server." },
      { status: 500 }
    );
  }

  // The client forwards its Supabase access token so server-side reads/writes
  // run as the user and satisfy row-level security.
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  let body: { userId?: unknown; contextType?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const contextType: ContextType = CONTEXT_TYPES.includes(
    body.contextType as ContextType
  )
    ? (body.contextType as ContextType)
    : "morning_briefing";

  if (!userId || !accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ctx: BusinessContext;
  try {
    ctx = await gatherContext(supabase, userId);
  } catch {
    return Response.json(
      { error: "Couldn't load your business data. Try again." },
      { status: 502 }
    );
  }

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(ctx) },
    { role: "user" as const, content: BRIEFING_INSTRUCTION[contextType] },
  ];

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        max_tokens: 400,
        messages,
      }),
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach your mentor. Try again." },
      { status: 502 }
    );
  }

  if (!groqRes.ok) {
    return Response.json(
      { error: "Your mentor is unavailable right now. Try again." },
      { status: 502 }
    );
  }

  const payload = await groqRes.json().catch(() => null);
  const reply: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return Response.json(
      { error: "No briefing came back. Try again." },
      { status: 422 }
    );
  }
  const replyText = reply.trim();

  // Persist the briefing with the snapshot that shaped it. A write failure
  // shouldn't cost the user their briefing, so we don't fail the request on it.
  await supabase.from("business_mentor_messages").insert({
    user_id: userId,
    role: "mentor",
    content: replyText,
    context_type: contextType,
    context_snapshot: ctx,
  });

  return Response.json({ reply: replyText });
}
