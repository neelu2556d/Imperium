import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import { getMentorSession } from "@/lib/supabase/mentor";

/**
 * Data layer for the Business tab's Overview page. Mirrors the client-side
 * fetch style of `dashboard.ts`: small, defensive readers off the browser
 * Supabase singleton, each resolving to a sensible default on failure so one
 * empty table never blanks the whole page. All reads are RLS-scoped to the
 * signed-in user in Postgres.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Local YYYY-MM-DD (matches how `order_date` / `due_date` are stored). */
function localISODate(date: Date): string {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SalesSummary {
  thisMonth: number;
  lastMonth: number;
  delta: number;
  /** Percent change vs last month; null when last month was zero. */
  pctChange: number | null;
}

export interface OutstandingSummary {
  total: number;
  invoiceCount: number;
}

export interface LotCounts {
  /** Lots with status in ('active','low_stock') — the headline count. */
  active: number;
  lowStock: number;
  deadStock: number;
}

export interface OrdersSummary {
  count: number;
  partiesVisited: number;
}

export interface OverdueEntry {
  id: string;
  partyName: string;
  amount: number;
  daysOverdue: number;
}

export interface OverdueSummary {
  entries: OverdueEntry[];
  totalCount: number;
}

export type LotStatus =
  | "arrived"
  | "active"
  | "low_stock"
  | "cleared"
  | "dead_stock";

export interface LotComponentStock {
  opening: number;
  sold: number;
  remaining: number;
}

export interface LotStock {
  lotId: string;
  itemName: string;
  dNo: string;
  designPhotoUrl: string | null;
  status: LotStatus;
  dateArrived: string;
  daysSince: number;
  threshold: number;
  top: LotComponentStock;
  bottom: LotComponentStock;
  dupatta: LotComponentStock;
}

export interface Briefing {
  id: string;
  content: string;
  createdAt: string;
}

export interface OverviewData {
  sales: SalesSummary;
  outstanding: OutstandingSummary;
  lots: LotCounts;
  orders: OrdersSummary;
  overdue: OverdueSummary;
  activeLots: LotStock[];
  briefing: Briefing | null;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Flips still-pending orders whose due date has passed to 'overdue'. Called on
 * every Overview load so the outstanding / overdue figures are current. Safe to
 * call repeatedly; the SQL function only touches matching rows.
 */
export async function refreshOverdueOrders(): Promise<void> {
  try {
    await ensureAnonymousSession();
    await supabase.rpc("refresh_overdue_orders");
  } catch {
    /* non-fatal — stale statuses just mean the numbers lag until next load */
  }
}

async function fetchSales(userId: string): Promise<SalesSummary> {
  const empty: SalesSummary = {
    thisMonth: 0,
    lastMonth: 0,
    delta: 0,
    pctChange: null,
  };
  try {
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, order_date")
      .eq("user_id", userId)
      .gte("order_date", localISODate(lastStart))
      .lt("order_date", localISODate(nextStart));
    if (error) throw error;

    const thisFrom = localISODate(thisStart);
    let thisMonth = 0;
    let lastMonth = 0;
    for (const row of data ?? []) {
      const amount = num(row.total_amount);
      if (String(row.order_date) >= thisFrom) thisMonth += amount;
      else lastMonth += amount;
    }

    const delta = thisMonth - lastMonth;
    const pctChange = lastMonth > 0 ? (delta / lastMonth) * 100 : null;
    return { thisMonth, lastMonth, delta, pctChange };
  } catch {
    return empty;
  }
}

async function fetchOutstanding(userId: string): Promise<OutstandingSummary> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("net_payable, amount_received")
      .eq("user_id", userId)
      .in("payment_status", ["pending", "overdue"]);
    if (error) throw error;

    const rows = data ?? [];
    const total = rows.reduce(
      (sum, r) => sum + (num(r.net_payable) - num(r.amount_received)),
      0
    );
    return { total, invoiceCount: rows.length };
  } catch {
    return { total: 0, invoiceCount: 0 };
  }
}

async function fetchLotCounts(userId: string): Promise<LotCounts> {
  try {
    const { data, error } = await supabase
      .from("lots")
      .select("status")
      .eq("user_id", userId);
    if (error) throw error;

    let active = 0;
    let lowStock = 0;
    let deadStock = 0;
    for (const row of data ?? []) {
      const s = String(row.status);
      if (s === "active" || s === "low_stock") active += 1;
      if (s === "low_stock") lowStock += 1;
      if (s === "dead_stock") deadStock += 1;
    }
    return { active, lowStock, deadStock };
  } catch {
    return { active: 0, lowStock: 0, deadStock: 0 };
  }
}

async function fetchOrdersThisMonth(userId: string): Promise<OrdersSummary> {
  try {
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data, error } = await supabase
      .from("orders")
      .select("party_id")
      .eq("user_id", userId)
      .gte("order_date", localISODate(thisStart))
      .lt("order_date", localISODate(nextStart));
    if (error) throw error;

    const rows = data ?? [];
    const parties = new Set(
      rows.map((r) => r.party_id).filter((id): id is string => Boolean(id))
    );
    return { count: rows.length, partiesVisited: parties.size };
  } catch {
    return { count: 0, partiesVisited: 0 };
  }
}

async function fetchOverdue(
  userId: string,
  limit = 3
): Promise<OverdueSummary> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, party_name, net_payable, amount_received, due_date")
      .eq("user_id", userId)
      .eq("payment_status", "overdue")
      .order("due_date", { ascending: true });
    if (error) throw error;

    const now = new Date();
    const rows = data ?? [];
    const entries: OverdueEntry[] = rows.slice(0, limit).map((r) => ({
      id: String(r.id),
      partyName: String(r.party_name ?? "Unknown party"),
      amount: num(r.net_payable) - num(r.amount_received),
      daysOverdue: r.due_date ? daysBetween(String(r.due_date), now) : 0,
    }));
    return { entries, totalCount: rows.length };
  } catch {
    return { entries: [], totalCount: 0 };
  }
}

/** Maps one `stock_register` view row to a LotStock. Shared with the Lots
 *  page's data layer (`lots.ts`), which reads the same view unfiltered. */
export function mapStockRegisterRow(
  r: Record<string, unknown>,
  now: Date
): LotStock {
  return {
    lotId: String(r.lot_id),
    itemName: String(r.item_name ?? "Untitled lot"),
    dNo: String(r.d_no ?? ""),
    designPhotoUrl: (r.design_photo_url as string | null) ?? null,
    status: String(r.status) as LotStatus,
    dateArrived: String(r.date_arrived ?? ""),
    daysSince: r.date_arrived ? daysBetween(String(r.date_arrived), now) : 0,
    threshold: num(r.low_stock_threshold_metres),
    top: {
      opening: num(r.top_opening_stock),
      sold: num(r.top_sold),
      remaining: num(r.top_remaining),
    },
    bottom: {
      opening: num(r.bottom_opening_stock),
      sold: num(r.bottom_sold),
      remaining: num(r.bottom_remaining),
    },
    dupatta: {
      opening: num(r.dupatta_opening_stock),
      sold: num(r.dupatta_sold),
      remaining: num(r.dupatta_remaining),
    },
  };
}

async function fetchActiveLotsWithStock(userId: string): Promise<LotStock[]> {
  try {
    const { data, error } = await supabase
      .from("stock_register")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["arrived", "active", "low_stock"])
      .order("date_arrived", { ascending: false });
    if (error) throw error;

    const now = new Date();
    return (data ?? []).map((r) => mapStockRegisterRow(r, now));
  } catch {
    return [];
  }
}

/** The latest morning briefing generated for today, if any. */
export async function fetchTodayBriefing(): Promise<Briefing | null> {
  try {
    const userId = await ensureAnonymousSession();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("business_mentor_messages")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .eq("role", "mentor")
      .eq("context_type", "morning_briefing")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      content: String(data.content),
      createdAt: String(data.created_at),
    };
  } catch {
    return null;
  }
}

/**
 * Loads everything the Overview page renders. Refreshes overdue statuses first,
 * then reads all sections in parallel.
 */
export async function fetchOverview(): Promise<OverviewData> {
  await refreshOverdueOrders();
  const userId = await ensureAnonymousSession();

  const [sales, outstanding, lots, orders, overdue, activeLots, briefing] =
    await Promise.all([
      fetchSales(userId),
      fetchOutstanding(userId),
      fetchLotCounts(userId),
      fetchOrdersThisMonth(userId),
      fetchOverdue(userId),
      fetchActiveLotsWithStock(userId),
      fetchTodayBriefing(),
    ]);

  return { sales, outstanding, lots, orders, overdue, activeLots, briefing };
}

/**
 * Triggers the Groq-backed morning briefing generation. Forwards the user's
 * access token so the API route's writes run under their RLS policies. Returns
 * the generated text; throws on failure so the caller can surface an error.
 */
export async function generateBriefing(): Promise<string> {
  const { userId, accessToken } = await getMentorSession();

  const res = await fetch("/api/business-mentor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId, contextType: "morning_briefing" }),
  });

  const payload = (await res.json().catch(() => null)) as {
    reply?: string;
    error?: string;
  } | null;

  if (!res.ok || !payload?.reply) {
    throw new Error(payload?.error ?? "Couldn't generate a briefing.");
  }
  return payload.reply;
}
