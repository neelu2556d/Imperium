/**
 * POST /api/business-mentor
 *
 * The brain behind the /business/imperium chat tab. Given a user's message and
 * a context type it:
 *   1. Gathers real business data from Supabase (scoped to the caller via their
 *      forwarded access token, so RLS returns their own rows).
 *   2. Builds a system prompt tailored to the context type.
 *   3. Calls Groq's OpenAI-compatible chat completions with the system prompt,
 *      the prior conversation history, and the new message.
 *   4. Persists both the user message and the mentor reply to
 *      business_mentor_messages, stamped with the context type.
 *
 * The Groq key stays server-side (GROQ_API_KEY) — the browser never sees it.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

/** How many prior turns to feed back as conversation history. */
const HISTORY_LIMIT = 20;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Local YYYY-MM-DD, matching how the tables store dates. */
function localISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole-day difference (to − from), floored, never negative. */
function daysBetween(from: string, to: Date): number {
  const d = new Date(`${from}T00:00:00`);
  const ms = to.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ---------------------------------------------------------------------------
// Context gathering
// ---------------------------------------------------------------------------

interface BusinessContext {
  todayOrders: { count: number; totalMetres: number; totalAmount: number };
  monthSale: { thisMonth: number; lastMonth: number; delta: number };
  outstanding: { total: number; overdueTotal: number };
  activeLots: {
    name: string;
    dNo: string;
    topRemaining: number;
    bottomRemaining: number;
    dupattaRemaining: number;
  }[];
  lowStockLots: { name: string; status: string }[];
  topParties: { name: string; sale: number }[];
  dormantParties: { name: string; daysSince: number }[];
  duePayments: {
    partyName: string;
    amount: number;
    dueDate: string;
  }[];
  last30Days: { orderCount: number; avgOrderValue: number };
}

/**
 * Pulls every slice of business context the system prompt needs, in parallel.
 * Each read is defensive: a failure resolves to a sensible default rather than
 * failing the whole request.
 */
async function gatherContext(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessContext> {
  const now = new Date();
  const today = localISODate(now);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days30Ago = new Date(now.getTime() - 30 * 86_400_000);
  const days14Ago = new Date(now.getTime() - 14 * 86_400_000);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  const thisMonthStr = localISODate(thisMonthStart);
  const lastMonthStr = localISODate(lastMonthStart);
  const nextMonthStr = localISODate(nextMonthStart);
  const days30AgoStr = localISODate(days30Ago);
  const days14AgoStr = localISODate(days14Ago);
  const in7DaysStr = localISODate(in7Days);

  // 1. Today's orders
  const todayOrdersP = supabase
    .from("orders")
    .select("total_metres, total_amount")
    .eq("user_id", userId)
    .eq("order_date", today);

  // 2. This month + last month sales
  const monthSalesP = supabase
    .from("orders")
    .select("total_amount, order_date")
    .eq("user_id", userId)
    .gte("order_date", lastMonthStr)
    .lt("order_date", nextMonthStr);

  // 3. Outstanding + overdue
  const outstandingP = supabase
    .from("orders")
    .select("net_payable, amount_received, payment_status")
    .eq("user_id", userId)
    .in("payment_status", ["pending", "overdue", "partial"]);

  // 4. Active lots with remaining stock
  const activeLotsP = supabase
    .from("stock_register")
    .select(
      "item_name, d_no, top_remaining, bottom_remaining, dupatta_remaining"
    )
    .eq("user_id", userId)
    .in("status", ["arrived", "active", "low_stock"])
    .order("date_arrived", { ascending: false });

  // 5. Low stock / dead stock lots
  const lowStockP = supabase
    .from("stock_register")
    .select("item_name, status")
    .eq("user_id", userId)
    .in("status", ["low_stock", "dead_stock"]);

  // 6. Top parties by sale this month
  const topPartiesP = supabase
    .from("orders")
    .select("party_name, total_amount")
    .eq("user_id", userId)
    .gte("order_date", thisMonthStr)
    .lt("order_date", nextMonthStr);

  // 7. All parties' last order date (for dormant detection)
  const allOrdersP = supabase
    .from("orders")
    .select("party_name, order_date")
    .eq("user_id", userId)
    .gte("order_date", days30AgoStr)
    .order("order_date", { ascending: false });

  // 8. Due payments in next 7 days
  const duePaymentsP = supabase
    .from("orders")
    .select("party_name, net_payable, amount_received, due_date")
    .eq("user_id", userId)
    .in("payment_status", ["pending", "partial"])
    .gte("due_date", today)
    .lte("due_date", in7DaysStr)
    .order("due_date", { ascending: true });

  // 9. Last 30 days orders for avg
  const last30P = supabase
    .from("orders")
    .select("total_amount")
    .eq("user_id", userId)
    .gte("order_date", days30AgoStr);

  const [
    todayOrdersR,
    monthSalesR,
    outstandingR,
    activeLotsR,
    lowStockR,
    topPartiesR,
    allOrdersR,
    duePaymentsR,
    last30R,
  ] = await Promise.all([
    todayOrdersP,
    monthSalesP,
    outstandingP,
    activeLotsP,
    lowStockP,
    topPartiesP,
    allOrdersP,
    duePaymentsP,
    last30P,
  ]);

  // --- Process today's orders ---
  const todayRows = todayOrdersR.data ?? [];
  const todayOrders = {
    count: todayRows.length,
    totalMetres: todayRows.reduce((s, r) => s + num(r.total_metres), 0),
    totalAmount: todayRows.reduce((s, r) => s + num(r.total_amount), 0),
  };

  // --- Process month sales ---
  const salesRows = monthSalesR.data ?? [];
  let thisMonth = 0;
  let lastMonth = 0;
  for (const row of salesRows) {
    const amount = num(row.total_amount);
    if (String(row.order_date) >= thisMonthStr) thisMonth += amount;
    else lastMonth += amount;
  }
  const monthSale = {
    thisMonth,
    lastMonth,
    delta: thisMonth - lastMonth,
  };

  // --- Process outstanding ---
  const outRows = outstandingR.data ?? [];
  let outstandingTotal = 0;
  let overdueTotal = 0;
  for (const r of outRows) {
    const balance = num(r.net_payable) - num(r.amount_received);
    outstandingTotal += balance;
    if (r.payment_status === "overdue") overdueTotal += balance;
  }
  const outstanding = { total: outstandingTotal, overdueTotal };

  // --- Process active lots ---
  const activeLots = (activeLotsR.data ?? []).map((r) => ({
    name: String(r.item_name ?? "Untitled"),
    dNo: String(r.d_no ?? ""),
    topRemaining: num(r.top_remaining),
    bottomRemaining: num(r.bottom_remaining),
    dupattaRemaining: num(r.dupatta_remaining),
  }));

  // --- Process low stock / dead stock ---
  const lowStockLots = (lowStockR.data ?? []).map((r) => ({
    name: String(r.item_name ?? "Untitled"),
    status: String(r.status),
  }));

  // --- Process top parties ---
  const partyMap = new Map<string, number>();
  for (const r of topPartiesR.data ?? []) {
    const name = String(r.party_name ?? "");
    if (!name) continue;
    partyMap.set(name, (partyMap.get(name) ?? 0) + num(r.total_amount));
  }
  const topParties = [...partyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, sale]) => ({ name, sale }));

  // --- Process dormant parties (>14 days since last order) ---
  const partyLastOrder = new Map<string, string>();
  for (const r of allOrdersR.data ?? []) {
    const name = String(r.party_name ?? "");
    const date = String(r.order_date ?? "");
    if (!name || !date) continue;
    if (!partyLastOrder.has(name) || date > partyLastOrder.get(name)!) {
      partyLastOrder.set(name, date);
    }
  }
  const dormantParties = [...partyLastOrder.entries()]
    .filter(([, lastDate]) => lastDate < days14AgoStr)
    .map(([name, lastDate]) => ({
      name,
      daysSince: daysBetween(lastDate, now),
    }))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 10);

  // --- Process due payments ---
  const duePayments = (duePaymentsR.data ?? []).map((r) => ({
    partyName: String(r.party_name ?? "Unknown"),
    amount: num(r.net_payable) - num(r.amount_received),
    dueDate: String(r.due_date ?? ""),
  }));

  // --- Process last 30 days ---
  const last30Rows = last30R.data ?? [];
  const last30Days = {
    orderCount: last30Rows.length,
    avgOrderValue:
      last30Rows.length > 0
        ? last30Rows.reduce((s, r) => s + num(r.total_amount), 0) /
          last30Rows.length
        : 0,
  };

  return {
    todayOrders,
    monthSale,
    outstanding,
    activeLots,
    lowStockLots,
    topParties,
    dormantParties,
    duePayments,
    last30Days,
  };
}

// ---------------------------------------------------------------------------
// Party-specific context (for pre-visit brief)
// ---------------------------------------------------------------------------

interface PartyContext {
  partyName: string;
  totalOrders: number;
  avgOrderSize: number;
  lastOrderDate: string;
  lastOrderItem: string;
  lastOrderAmount: number;
  outstanding: number;
  overdue: boolean;
  mostOrderedItems: { item: string; count: number; avgRate: number }[];
  avgPaymentDays: { actual: number; agreed: number };
}

async function gatherPartyContext(
  supabase: SupabaseClient,
  userId: string,
  partyName: string
): Promise<PartyContext | null> {
  const partyRes = await supabase
    .from("party_master")
    .select("id, party_name, default_payment_days")
    .eq("user_id", userId)
    .ilike("party_name", partyName)
    .maybeSingle();

  const party = partyRes.data;
  if (!party) return null;

  const partyId = String(party.id);
  const agreedDays = num(party.default_payment_days);

  const ordersRes = await supabase
    .from("orders")
    .select(
      "order_date, item_name, total_amount, total_metres, net_payable, amount_received, payment_days, payment_status, top_rate, bottom_rate, dupatta_rate"
    )
    .eq("user_id", userId)
    .eq("party_id", partyId)
    .order("order_date", { ascending: false });

  const orders = ordersRes.data ?? [];
  if (orders.length === 0) {
    return {
      partyName: String(party.party_name),
      totalOrders: 0,
      avgOrderSize: 0,
      lastOrderDate: "",
      lastOrderItem: "",
      lastOrderAmount: 0,
      outstanding: 0,
      overdue: false,
      mostOrderedItems: [],
      avgPaymentDays: { actual: 0, agreed: agreedDays },
    };
  }

  let totalOutstanding = 0;
  let hasOverdue = false;
  const itemStats = new Map<
    string,
    { count: number; totalRate: number; rateCount: number }
  >();
  let totalPaymentDays = 0;
  let paymentDayCount = 0;

  for (const o of orders) {
    const balance = num(o.net_payable) - num(o.amount_received);
    if (
      o.payment_status === "pending" ||
      o.payment_status === "overdue" ||
      o.payment_status === "partial"
    ) {
      totalOutstanding += balance;
    }
    if (o.payment_status === "overdue") hasOverdue = true;

    const item = String(o.item_name ?? "");
    if (item) {
      if (!itemStats.has(item)) {
        itemStats.set(item, { count: 0, totalRate: 0, rateCount: 0 });
      }
      const s = itemStats.get(item)!;
      s.count += 1;
      const avgRate =
        (num(o.top_rate) + num(o.bottom_rate) + num(o.dupatta_rate)) / 3;
      if (avgRate > 0) {
        s.totalRate += avgRate;
        s.rateCount += 1;
      }
    }

    if (num(o.payment_days) > 0) {
      totalPaymentDays += num(o.payment_days);
      paymentDayCount += 1;
    }
  }

  const mostOrderedItems = [...itemStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([item, s]) => ({
      item,
      count: s.count,
      avgRate: s.rateCount > 0 ? s.totalRate / s.rateCount : 0,
    }));

  const lastOrder = orders[0];
  const avgOrderSize =
    orders.reduce((s, o) => s + num(o.total_amount), 0) / orders.length;

  return {
    partyName: String(party.party_name),
    totalOrders: orders.length,
    avgOrderSize: Math.round(avgOrderSize),
    lastOrderDate: String(lastOrder.order_date ?? ""),
    lastOrderItem: String(lastOrder.item_name ?? ""),
    lastOrderAmount: num(lastOrder.total_amount),
    outstanding: totalOutstanding,
    overdue: hasOverdue,
    mostOrderedItems,
    avgPaymentDays: {
      actual:
        paymentDayCount > 0
          ? Math.round(totalPaymentDays / paymentDayCount)
          : 0,
      agreed: agreedDays,
    },
  };
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

function formatContextBlock(ctx: BusinessContext): string {
  const lines: string[] = [];

  lines.push(
    `Today's orders: ${ctx.todayOrders.count} orders, ` +
      `${ctx.todayOrders.totalMetres} metres, ` +
      `₹${ctx.todayOrders.totalAmount.toLocaleString("en-IN")}`
  );

  lines.push(
    `Month sale: ₹${ctx.monthSale.thisMonth.toLocaleString("en-IN")} ` +
      `(last month: ₹${ctx.monthSale.lastMonth.toLocaleString("en-IN")}, ` +
      `delta: ₹${ctx.monthSale.delta.toLocaleString("en-IN")})`
  );

  lines.push(
    `Outstanding: ₹${ctx.outstanding.total.toLocaleString("en-IN")} ` +
      `(overdue: ₹${ctx.outstanding.overdueTotal.toLocaleString("en-IN")})`
  );

  if (ctx.activeLots.length > 0) {
    lines.push(
      `Active lots (${ctx.activeLots.length}): ` +
        ctx.activeLots
          .map(
            (l) =>
              `${l.name} D${l.dNo} [T:${l.topRemaining} B:${l.bottomRemaining} D:${l.dupattaRemaining}]`
          )
          .join("; ")
    );
  }

  if (ctx.lowStockLots.length > 0) {
    lines.push(
      `Low/dead stock: ` +
        ctx.lowStockLots.map((l) => `${l.name} (${l.status})`).join(", ")
    );
  }

  if (ctx.topParties.length > 0) {
    lines.push(
      `Top parties this month: ` +
        ctx.topParties
          .map((p) => `${p.name} ₹${p.sale.toLocaleString("en-IN")}`)
          .join(", ")
    );
  }

  if (ctx.dormantParties.length > 0) {
    lines.push(
      `Dormant parties (>14 days): ` +
        ctx.dormantParties
          .map((p) => `${p.name} (${p.daysSince}d)`)
          .join(", ")
    );
  }

  if (ctx.duePayments.length > 0) {
    lines.push(
      `Due payments (next 7 days): ` +
        ctx.duePayments
          .map(
            (p) =>
              `${p.partyName} ₹${p.amount.toLocaleString("en-IN")} due ${p.dueDate}`
          )
          .join("; ")
    );
  }

  lines.push(
    `Last 30 days: ${ctx.last30Days.orderCount} orders, avg ₹${Math.round(ctx.last30Days.avgOrderValue).toLocaleString("en-IN")}`
  );

  return lines.join("\n");
}

function buildSystemPrompt(
  contextType: string,
  ctx: BusinessContext,
  partyCtx: PartyContext | null,
  partyName?: string
): string {
  const today = localISODate();
  const dataBlock = formatContextBlock(ctx);

  switch (contextType) {
    case "morning_briefing":
      return (
        `You are Imperium, a business intelligence assistant for a dress material ` +
        `wholesale business. Today is ${today}.\n\n` +
        `BUSINESS DATA:\n${dataBlock}\n\n` +
        `Be concise, direct, and specific. No generic advice.\n` +
        `Your response must be structured as:\n` +
        `1. ONE priority alert if urgent (overdue amount or low stock)\n` +
        `2. Today's focus — which lots to push, which parties to visit\n` +
        `3. One thing to watch today\n` +
        `Respond in under 120 words. Use the data provided. Be blunt.`
      );

    case "pre_visit": {
      if (!partyCtx) {
        return (
          `You are Imperium, a business intelligence assistant. The user wants ` +
          `a pre-visit brief for "${partyName}" but no data was found for this ` +
          `party. Ask them to check the party name or create the party first.`
        );
      }
      const p = partyCtx;
      return (
        `You are Imperium, preparing a pre-visit brief. The user is about to ` +
        `visit ${p.partyName}.\n\n` +
        `PARTY DATA:\n` +
        `- Total orders: ${p.totalOrders}\n` +
        `- Avg order size: ₹${p.avgOrderSize.toLocaleString("en-IN")}\n` +
        `- Last order: ${p.lastOrderDate || "never"} — ${p.lastOrderItem} ` +
        `for ₹${p.lastOrderAmount.toLocaleString("en-IN")}\n` +
        `- Outstanding: ₹${p.outstanding.toLocaleString("en-IN")}${p.overdue ? " (OVERDUE)" : ""}\n` +
        `- Most ordered items: ${p.mostOrderedItems.map((i) => `${i.item} (${i.count}x, avg ₹${Math.round(i.avgRate)}/m)`).join(", ") || "none"}\n` +
        `- Avg payment days: ${p.avgPaymentDays.actual} actual vs ${p.avgPaymentDays.agreed} agreed\n\n` +
        `BUSINESS CONTEXT:\n${dataBlock}\n\n` +
        `Be specific to this party's actual data. Cover:\n` +
        `1. Outstanding/overdue if any — exact amount\n` +
        `2. Their buying pattern — what they usually order and how much\n` +
        `3. Last order — when, what, how much\n` +
        `4. Suggested opening (what to show them based on their history)\n` +
        `5. One watch-out (slow payer? price-sensitive? specific item?)\n` +
        `Keep it under 150 words. Data-driven, no fluff.`
      );
    }

    case "post_day": {
      const dailyAvg =
        ctx.last30Days.orderCount > 0 ? ctx.last30Days.avgOrderValue : 0;
      return (
        `You are Imperium, doing a post-day debrief. Today is ${today}.\n\n` +
        `TODAY'S DATA:\n` +
        `- Orders today: ${ctx.todayOrders.count}\n` +
        `- Total metres today: ${ctx.todayOrders.totalMetres}\n` +
        `- Total amount today: ₹${ctx.todayOrders.totalAmount.toLocaleString("en-IN")}\n` +
        `- Month daily average: ₹${Math.round(dailyAvg).toLocaleString("en-IN")}\n` +
        `- This month total: ₹${ctx.monthSale.thisMonth.toLocaleString("en-IN")}\n` +
        `- Last month total: ₹${ctx.monthSale.lastMonth.toLocaleString("en-IN")}\n\n` +
        `Respond with:\n` +
        `1. Today's performance vs the month's daily average\n` +
        `2. One thing that went well\n` +
        `3. One thing to improve tomorrow\n` +
        `Under 80 words.`
      );
    }

    default:
      return (
        `You are Imperium, a business intelligence assistant for a dress ` +
        `material wholesale business in India. You have access to the user's ` +
        `complete business data. Answer questions about lots, parties, sales, ` +
        `stock, payments, and performance. Be specific and data-driven. If the ` +
        `data doesn't contain the answer, say so rather than guessing.\n\n` +
        `BUSINESS DATA:\n${dataBlock}\n\n` +
        `Keep answers under 150 words unless detail is requested.`
      );
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  let body: { message?: unknown; userId?: unknown; contextType?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const contextType =
    typeof body.contextType === "string" ? body.contextType : "chat";

  if (!userId || !accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Morning briefing can be generated with an empty user message.
  if (!message && contextType !== "morning_briefing") {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Gather business context.
  let ctx: BusinessContext;
  try {
    ctx = await gatherContext(supabase, userId);
  } catch {
    return Response.json(
      { error: "Couldn't load your business data. Try again." },
      { status: 502 }
    );
  }

  // 2. For pre-visit, also gather party-specific context.
  let partyCtx: PartyContext | null = null;
  let partyName: string | undefined;
  if (contextType === "pre_visit" && message) {
    partyName = message;
    try {
      partyCtx = await gatherPartyContext(supabase, userId, partyName);
    } catch {
      /* non-fatal — prompt will handle missing data */
    }
  }

  // 3. Build system prompt.
  const systemPrompt = buildSystemPrompt(contextType, ctx, partyCtx, partyName);

  // 4. Prior turns (oldest → newest) become conversation history.
  const { data: historyRows } = await supabase
    .from("business_mentor_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      role: r.role === "mentor" ? "assistant" : "user",
      content: String(r.content),
    }));

  // For morning briefing with empty message, use a synthetic user message.
  const userMessage =
    contextType === "morning_briefing" && !message
      ? "Generate my morning briefing."
      : message;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  // 5. Groq chat completion.
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
        temperature: 0.7,
        max_tokens: 512,
        messages,
      }),
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach your business mentor. Try again." },
      { status: 502 }
    );
  }

  if (!groqRes.ok) {
    return Response.json(
      { error: "Your business mentor is unavailable right now. Try again." },
      { status: 502 }
    );
  }

  const payload = await groqRes.json().catch(() => null);
  const reply: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return Response.json(
      { error: "No reply came back. Try rephrasing." },
      { status: 422 }
    );
  }
  const replyText = reply.trim();

  // 6. Persist both turns.
  await supabase.from("business_mentor_messages").insert([
    {
      user_id: userId,
      role: "user",
      content: userMessage,
      context_type: contextType,
    },
    {
      user_id: userId,
      role: "mentor",
      content: replyText,
      context_type: contextType,
    },
  ]);

  return Response.json({ reply: replyText });
}
