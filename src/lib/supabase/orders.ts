import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import type { LotStatus } from "@/lib/supabase/business";

/**
 * Data layer for the Business tab's Orders section: the order list + detail,
 * the party master + rate-card lookups behind the entry form, the active-lot
 * picker (remaining stock per component), and order creation with its derived
 * pricing. Same conventions as `business.ts` / `lots.ts`: defensive readers off
 * the browser Supabase singleton, every query RLS-scoped to the signed-in user.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** GST rate applied to the after-discount amount when a party is GST. */
const GST_RATE = 0.05;

/** Local YYYY-MM-DD (matches how `order_date` / `due_date` are stored). */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** order_date + payment_days, as a local YYYY-MM-DD string. */
export function computeDueDate(orderDate: string, paymentDays: number): string {
  const base = new Date(`${orderDate}T00:00:00`);
  base.setDate(base.getDate() + paymentDays);
  return localISODate(base);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentStatus = "pending" | "paid" | "overdue" | "partial";

/** One row in the orders list / detail sheet. */
export interface OrderRow {
  id: string;
  orderDate: string;
  partyName: string;
  itemName: string;
  dNo: string;
  totalMetres: number;
  totalAmount: number;
  netPayable: number;
  status: PaymentStatus;
}

/** One row of the Sales Register — an OrderRow plus the extra columns the
 *  register table renders (per-component metres, GST, credit term, due date).
 *  Extends OrderRow so it can be passed straight to the OrderDetailSheet. */
export interface SalesRow extends OrderRow {
  topTotalMetres: number;
  bottomTotalMetres: number;
  dupattaTotalMetres: number;
  gstAmount: number;
  paymentDays: number;
  dueDate: string;
}

/** Full pricing breakdown for the order detail sheet. */
export interface OrderDetail extends OrderRow {
  topPerColour: number;
  bottomPerColour: number;
  dupattaPerColour: number;
  numColours: number;
  topTotalMetres: number;
  bottomTotalMetres: number;
  dupattaTotalMetres: number;
  topRate: number;
  bottomRate: number;
  dupattaRate: number;
  topAmount: number;
  bottomAmount: number;
  dupattaAmount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  afterDiscount: number;
  gstApplicable: boolean;
  gstAmount: number;
  cdPercent: number;
  cdAmount: number;
  paymentDays: number;
  dueDate: string;
  amountReceived: number;
}

export interface PartyEntry {
  id: string;
  partyName: string;
  area: string | null;
  city: string | null;
  defaultPaymentDays: number;
  cdPercent: number;
  gstPreference: "gst" | "non_gst";
}

/** One active/arrived lot the order form can pick, with remaining stock. */
export interface ActiveLotOption {
  lotId: string;
  itemId: string | null;
  itemName: string;
  dNo: string;
  designPhotoUrl: string | null;
  status: LotStatus;
  topRemaining: number;
  bottomRemaining: number;
  dupattaRemaining: number;
}

export interface RateCard {
  topRate: number | null;
  bottomRate: number | null;
  dupattaRate: number | null;
}

export interface NewOrderInput {
  lotId: string;
  itemId: string | null;
  itemName: string;
  dNo: string;
  partyId: string;
  partyName: string;
  topPerColour: number;
  bottomPerColour: number;
  dupattaPerColour: number;
  numColours: number;
  topRate: number;
  bottomRate: number;
  dupattaRate: number;
  discountPercent: number;
  gstApplicable: boolean;
  cdPercent: number;
  paymentDays: number;
}

export interface OrderTotals {
  topTotalMetres: number;
  bottomTotalMetres: number;
  dupattaTotalMetres: number;
  totalMetres: number;
  topAmount: number;
  bottomAmount: number;
  dupattaAmount: number;
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  gstAmount: number;
  totalAmount: number;
  cdAmount: number;
  netPayable: number;
}

// ---------------------------------------------------------------------------
// Pure pricing — shared by the live preview and the save path so the number
// the user sees is exactly the number that gets stored.
// ---------------------------------------------------------------------------

export function computeTotals(input: {
  topPerColour: number;
  bottomPerColour: number;
  dupattaPerColour: number;
  numColours: number;
  topRate: number;
  bottomRate: number;
  dupattaRate: number;
  discountPercent: number;
  gstApplicable: boolean;
  cdPercent: number;
}): OrderTotals {
  const colours = Math.max(0, input.numColours);
  const topTotalMetres = num(input.topPerColour) * colours;
  const bottomTotalMetres = num(input.bottomPerColour) * colours;
  const dupattaTotalMetres = num(input.dupattaPerColour) * colours;
  const totalMetres = topTotalMetres + bottomTotalMetres + dupattaTotalMetres;

  const topAmount = topTotalMetres * num(input.topRate);
  const bottomAmount = bottomTotalMetres * num(input.bottomRate);
  const dupattaAmount = dupattaTotalMetres * num(input.dupattaRate);
  const subtotal = topAmount + bottomAmount + dupattaAmount;

  const discountAmount = subtotal * (num(input.discountPercent) / 100);
  const afterDiscount = subtotal - discountAmount;
  const gstAmount = input.gstApplicable ? afterDiscount * GST_RATE : 0;
  const totalAmount = afterDiscount + gstAmount;
  const cdAmount = totalAmount * (num(input.cdPercent) / 100);
  const netPayable = totalAmount - cdAmount;

  return {
    topTotalMetres,
    bottomTotalMetres,
    dupattaTotalMetres,
    totalMetres,
    topAmount,
    bottomAmount,
    dupattaAmount,
    subtotal,
    discountAmount,
    afterDiscount,
    gstAmount,
    totalAmount,
    cdAmount,
    netPayable,
  };
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

const ORDER_ROW_COLUMNS =
  "id, order_date, party_name, item_name, d_no, total_metres, total_amount, net_payable, payment_status";

function mapOrderRow(r: Record<string, unknown>): OrderRow {
  return {
    id: String(r.id),
    orderDate: String(r.order_date ?? ""),
    partyName: String(r.party_name ?? "Unknown party"),
    itemName: String(r.item_name ?? "—"),
    dNo: String(r.d_no ?? ""),
    totalMetres: num(r.total_metres),
    totalAmount: num(r.total_amount),
    netPayable: num(r.net_payable),
    status: String(r.payment_status ?? "pending") as PaymentStatus,
  };
}

/**
 * Flips still-pending orders whose due date has passed to 'overdue', so the
 * list's status pills are current. Safe to call on every list load.
 */
export async function refreshOverdueOrders(): Promise<void> {
  try {
    await ensureAnonymousSession();
    await supabase.rpc("refresh_overdue_orders");
  } catch {
    /* non-fatal — stale statuses just lag until the next load */
  }
}

/** Every order, newest first. Filtering + search are done client-side — one
 *  small query for a single wholesaler. */
export async function fetchAllOrders(): Promise<OrderRow[]> {
  try {
    await refreshOverdueOrders();
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_ROW_COLUMNS)
      .eq("user_id", userId)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapOrderRow);
  } catch {
    return [];
  }
}

const SALES_ROW_COLUMNS =
  "id, order_date, party_name, item_name, d_no, " +
  "top_total_metres, bottom_total_metres, dupatta_total_metres, total_metres, " +
  "total_amount, gst_amount, net_payable, payment_days, due_date, payment_status";

function mapSalesRow(r: Record<string, unknown>): SalesRow {
  return {
    ...mapOrderRow(r),
    topTotalMetres: num(r.top_total_metres),
    bottomTotalMetres: num(r.bottom_total_metres),
    dupattaTotalMetres: num(r.dupatta_total_metres),
    gstAmount: num(r.gst_amount),
    paymentDays: num(r.payment_days),
    dueDate: String(r.due_date ?? ""),
  };
}

/**
 * Every order as a Sales Register row, newest first. Like {@link fetchAllOrders}
 * this refreshes overdue statuses first and pulls the whole (single-wholesaler)
 * table in one query; the register does its date filtering client-side.
 */
export async function fetchSalesRows(): Promise<SalesRow[]> {
  try {
    await refreshOverdueOrders();
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select(SALES_ROW_COLUMNS)
      .eq("user_id", userId)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => mapSalesRow(r));
  } catch {
    return [];
  }
}

/** One order's full pricing breakdown for the detail sheet. */
export async function fetchOrderDetail(
  orderId: string
): Promise<OrderDetail | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) return null;

    return {
      ...mapOrderRow(data),
      topPerColour: num(data.top_metres_per_colour),
      bottomPerColour: num(data.bottom_metres_per_colour),
      dupattaPerColour: num(data.dupatta_metres_per_colour),
      numColours: num(data.num_colours),
      topTotalMetres: num(data.top_total_metres),
      bottomTotalMetres: num(data.bottom_total_metres),
      dupattaTotalMetres: num(data.dupatta_total_metres),
      topRate: num(data.top_rate),
      bottomRate: num(data.bottom_rate),
      dupattaRate: num(data.dupatta_rate),
      topAmount: num(data.top_amount),
      bottomAmount: num(data.bottom_amount),
      dupattaAmount: num(data.dupatta_amount),
      subtotal: num(data.subtotal),
      discountPercent: num(data.discount_percent),
      discountAmount: num(data.discount_amount),
      afterDiscount: num(data.after_discount),
      gstApplicable: Boolean(data.gst_applicable),
      gstAmount: num(data.gst_amount),
      cdPercent: num(data.cd_percent),
      cdAmount: num(data.cd_amount),
      paymentDays: num(data.payment_days),
      dueDate: String(data.due_date ?? ""),
      amountReceived: num(data.amount_received),
    };
  } catch {
    return null;
  }
}

/** The user's party master, for the order form's party dropdown. */
export async function fetchParties(): Promise<PartyEntry[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("party_master")
      .select(
        "id, party_name, area, city, default_payment_days, cd_percent, gst_preference"
      )
      .eq("user_id", userId)
      .order("party_name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      partyName: String(r.party_name),
      area: (r.area as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      defaultPaymentDays: num(r.default_payment_days),
      cdPercent: num(r.cd_percent),
      gstPreference:
        r.gst_preference === "gst" ? "gst" : "non_gst",
    }));
  } catch {
    return [];
  }
}

/** Active/arrived/low-stock lots with per-component remaining metres, for the
 *  order form's lot picker. Reads the same stock_register view as the Lots
 *  page. */
export async function fetchActiveLotOptions(): Promise<ActiveLotOption[]> {
  try {
    const userId = await ensureAnonymousSession();
    const [stockRes, lotsRes] = await Promise.all([
      supabase
        .from("stock_register")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["arrived", "active", "low_stock"])
        .order("date_arrived", { ascending: false }),
      supabase
        .from("lots")
        .select("id, item_id")
        .eq("user_id", userId),
    ]);
    if (stockRes.error) throw stockRes.error;

    const itemIdByLot = new Map<string, string | null>();
    for (const l of lotsRes.data ?? []) {
      itemIdByLot.set(String(l.id), (l.item_id as string | null) ?? null);
    }

    return (stockRes.data ?? []).map((r) => ({
      lotId: String(r.lot_id),
      itemId: itemIdByLot.get(String(r.lot_id)) ?? null,
      itemName: String(r.item_name ?? "Untitled lot"),
      dNo: String(r.d_no ?? ""),
      designPhotoUrl: (r.design_photo_url as string | null) ?? null,
      status: String(r.status) as LotStatus,
      topRemaining: num(r.top_remaining),
      bottomRemaining: num(r.bottom_remaining),
      dupattaRemaining: num(r.dupatta_remaining),
    }));
  } catch {
    return [];
  }
}

/** Saved rates for a party + item pair, or null if none exists yet. */
export async function fetchRateCard(
  partyId: string,
  itemId: string
): Promise<RateCard | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("party_rate_cards")
      .select("top_rate, bottom_rate, dupatta_rate")
      .eq("user_id", userId)
      .eq("party_id", partyId)
      .eq("item_id", itemId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      topRate: data.top_rate == null ? null : num(data.top_rate),
      bottomRate: data.bottom_rate == null ? null : num(data.bottom_rate),
      dupattaRate: data.dupatta_rate == null ? null : num(data.dupatta_rate),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

export interface NewPartyInput {
  partyName: string;
  area: string | null;
  city: string | null;
}

/**
 * Inserts a new party (from the "Add [name] as new party" mini-form) and
 * returns it. On a name conflict (already exists) falls back to a lookup so
 * the caller always gets a usable party. Throws only if both paths fail.
 */
export async function createParty(input: NewPartyInput): Promise<PartyEntry> {
  const userId = await ensureAnonymousSession();
  const partyName = input.partyName.trim();

  const { data, error } = await supabase
    .from("party_master")
    .insert({
      user_id: userId,
      party_name: partyName,
      area: input.area?.trim() || null,
      city: input.city?.trim() || null,
    })
    .select(
      "id, party_name, area, city, default_payment_days, cd_percent, gst_preference"
    )
    .single();

  if (!error && data) {
    return {
      id: String(data.id),
      partyName: String(data.party_name),
      area: (data.area as string | null) ?? null,
      city: (data.city as string | null) ?? null,
      defaultPaymentDays: num(data.default_payment_days),
      cdPercent: num(data.cd_percent),
      gstPreference: data.gst_preference === "gst" ? "gst" : "non_gst",
    };
  }

  const { data: existing } = await supabase
    .from("party_master")
    .select(
      "id, party_name, area, city, default_payment_days, cd_percent, gst_preference"
    )
    .eq("user_id", userId)
    .eq("party_name", partyName)
    .maybeSingle();
  if (existing) {
    return {
      id: String(existing.id),
      partyName: String(existing.party_name),
      area: (existing.area as string | null) ?? null,
      city: (existing.city as string | null) ?? null,
      defaultPaymentDays: num(existing.default_payment_days),
      cdPercent: num(existing.cd_percent),
      gstPreference: existing.gst_preference === "gst" ? "gst" : "non_gst",
    };
  }
  throw error ?? new Error("Couldn't save the party.");
}

/** The result of saving an order: the id, the stored totals, and whether the
 *  rates differed from an existing rate card (so the form can prompt to
 *  update it). */
export interface SaveOrderResult {
  orderId: string;
  totals: OrderTotals;
  dueDate: string;
  /** null: no existing card (rates auto-saved). true: card existed and rates
   *  changed (caller should prompt). false: card existed and rates matched. */
  rateCardChanged: boolean | null;
}

/**
 * Creates an order: computes every derived field, inserts the row (the lot
 * status trigger fires in Postgres), and auto-saves a rate card if none
 * existed for this party + item. Returns the totals and a flag telling the
 * form whether to prompt about updating an existing rate card. Throws on
 * failure so the form can surface the error.
 */
export async function createOrder(
  input: NewOrderInput
): Promise<SaveOrderResult> {
  const userId = await ensureAnonymousSession();
  const orderDate = localISODate(new Date());
  const dueDate = computeDueDate(orderDate, input.paymentDays);
  const totals = computeTotals(input);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      lot_id: input.lotId,
      party_id: input.partyId,
      item_id: input.itemId,
      item_name: input.itemName || null,
      d_no: input.dNo || null,
      party_name: input.partyName || null,
      order_date: orderDate,
      top_metres_per_colour: input.topPerColour,
      bottom_metres_per_colour: input.bottomPerColour,
      dupatta_metres_per_colour: input.dupattaPerColour,
      num_colours: input.numColours,
      top_total_metres: totals.topTotalMetres,
      bottom_total_metres: totals.bottomTotalMetres,
      dupatta_total_metres: totals.dupattaTotalMetres,
      total_metres: totals.totalMetres,
      top_rate: input.topRate,
      bottom_rate: input.bottomRate,
      dupatta_rate: input.dupattaRate,
      top_amount: totals.topAmount,
      bottom_amount: totals.bottomAmount,
      dupatta_amount: totals.dupattaAmount,
      subtotal: totals.subtotal,
      discount_percent: input.discountPercent,
      discount_amount: totals.discountAmount,
      after_discount: totals.afterDiscount,
      gst_applicable: input.gstApplicable,
      gst_amount: totals.gstAmount,
      total_amount: totals.totalAmount,
      cd_percent: input.cdPercent,
      cd_amount: totals.cdAmount,
      net_payable: totals.netPayable,
      payment_days: input.paymentDays,
      due_date: dueDate,
      payment_status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't save the order.");

  const rateCardChanged = await reconcileRateCard(userId, input);

  return { orderId: String(data.id), totals, dueDate, rateCardChanged };
}

const RATE_EPSILON = 0.005;
function ratesDiffer(a: number | null, b: number): boolean {
  return Math.abs(num(a) - b) > RATE_EPSILON;
}

/**
 * Compares the order's rates against any saved card for this party + item.
 * When none exists, auto-saves one and returns null. When one exists, returns
 * whether the rates changed (the form prompts on true) without writing — the
 * user decides via {@link upsertRateCard}.
 */
async function reconcileRateCard(
  userId: string,
  input: NewOrderInput
): Promise<boolean | null> {
  if (!input.itemId) return null;
  try {
    const existing = await fetchRateCard(input.partyId, input.itemId);
    if (!existing) {
      await upsertRateCard(input.partyId, input.itemId, {
        topRate: input.topRate,
        bottomRate: input.bottomRate,
        dupattaRate: input.dupattaRate,
      });
      return null;
    }
    return (
      ratesDiffer(existing.topRate, input.topRate) ||
      ratesDiffer(existing.bottomRate, input.bottomRate) ||
      ratesDiffer(existing.dupattaRate, input.dupattaRate)
    );
  } catch {
    return null;
  }
}

/** Inserts or updates the saved rate card for a party + item pair. */
export async function upsertRateCard(
  partyId: string,
  itemId: string,
  rates: { topRate: number; bottomRate: number; dupattaRate: number }
): Promise<void> {
  const userId = await ensureAnonymousSession();
  await supabase.from("party_rate_cards").upsert(
    {
      user_id: userId,
      party_id: partyId,
      item_id: itemId,
      top_rate: rates.topRate,
      bottom_rate: rates.bottomRate,
      dupatta_rate: rates.dupattaRate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,party_id,item_id" }
  );
}
