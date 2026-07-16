import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";
import {
  mapStockRegisterRow,
  type LotStock,
  type LotStatus,
} from "@/lib/supabase/business";

/**
 * Data layer for the Business tab's Lots section: the lot list, the lot detail
 * page (stock + orders + profitability), the item-master lookup behind the new
 * lot form, and lot creation with its Storage uploads. Same conventions as
 * `business.ts`: defensive readers off the browser Supabase singleton, RLS
 * scoping every query to the signed-in user.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PHOTO_BUCKET = "lot-photos";
const REPORT_BUCKET = "lot-reports";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LotOrder {
  id: string;
  orderDate: string;
  partyName: string;
  totalMetres: number;
  netPayable: number;
  paymentStatus: "pending" | "paid" | "overdue" | "partial";
}

export interface LotCosts {
  top: number | null;
  bottom: number | null;
  dupatta: number | null;
}

export interface LotProfitability {
  totalCost: number;
  revenue: number;
  grossProfit: number;
  /** Percent of revenue; null when there's no revenue yet. */
  marginPct: number | null;
  unsoldStockValue: number;
}

export interface LotDetail {
  stock: LotStock;
  lotReportUrl: string | null;
  costs: LotCosts;
  orders: LotOrder[];
  /** Only present when at least one cost price was entered on the lot. */
  profitability: LotProfitability | null;
}

export interface ItemMasterEntry {
  id: string;
  itemName: string;
}

export interface NewLotInput {
  itemId: string | null;
  itemName: string;
  dNo: string;
  designPhoto: File | null;
  lotReport: File | null;
  topMetres: number;
  bottomMetres: number;
  dupattaMetres: number;
  topCost: number | null;
  bottomCost: number | null;
  dupattaCost: number | null;
  threshold: number;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Every lot (all statuses), newest arrival first. Status filtering is done
 *  client-side — the whole list is one small query for a single wholesaler. */
export async function fetchAllLots(): Promise<LotStock[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("stock_register")
      .select("*")
      .eq("user_id", userId)
      .order("date_arrived", { ascending: false });
    if (error) throw error;

    const now = new Date();
    return (data ?? []).map((r) => mapStockRegisterRow(r, now));
  } catch {
    return [];
  }
}

function computeProfitability(
  stock: LotStock,
  costs: LotCosts,
  revenue: number
): LotProfitability | null {
  if (costs.top == null && costs.bottom == null && costs.dupatta == null) {
    return null;
  }

  const components = [
    [stock.top, costs.top],
    [stock.bottom, costs.bottom],
    [stock.dupatta, costs.dupatta],
  ] as const;

  let totalCost = 0;
  let unsoldStockValue = 0;
  for (const [comp, cost] of components) {
    if (cost == null) continue;
    totalCost += comp.opening * cost;
    unsoldStockValue += Math.max(0, comp.remaining) * cost;
  }

  // Gross profit compares revenue against the cost of what was actually sold
  // (opening cost minus the value still sitting on the shelf).
  const costOfSold = totalCost - unsoldStockValue;
  const grossProfit = revenue - costOfSold;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : null;

  return { totalCost, revenue, grossProfit, marginPct, unsoldStockValue };
}

/** Everything the lot detail page renders, or null when the lot isn't found
 *  (bad URL / someone else's lot — RLS returns no rows either way). */
export async function fetchLotDetail(lotId: string): Promise<LotDetail | null> {
  try {
    const userId = await ensureAnonymousSession();

    const [stockRes, lotRes, ordersRes] = await Promise.all([
      supabase
        .from("stock_register")
        .select("*")
        .eq("user_id", userId)
        .eq("lot_id", lotId)
        .maybeSingle(),
      supabase
        .from("lots")
        .select(
          "lot_report_url, top_cost_per_metre, bottom_cost_per_metre, dupatta_cost_per_metre"
        )
        .eq("user_id", userId)
        .eq("id", lotId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id, order_date, party_name, total_metres, net_payable, payment_status"
        )
        .eq("user_id", userId)
        .eq("lot_id", lotId)
        .order("order_date", { ascending: false }),
    ]);
    if (stockRes.error || !stockRes.data) return null;

    const stock = mapStockRegisterRow(stockRes.data, new Date());

    const lotRow = lotRes.data;
    const costOrNull = (v: unknown): number | null =>
      v == null ? null : num(v);
    const costs: LotCosts = {
      top: costOrNull(lotRow?.top_cost_per_metre),
      bottom: costOrNull(lotRow?.bottom_cost_per_metre),
      dupatta: costOrNull(lotRow?.dupatta_cost_per_metre),
    };

    const orders: LotOrder[] = (ordersRes.data ?? []).map((r) => ({
      id: String(r.id),
      orderDate: String(r.order_date ?? ""),
      partyName: String(r.party_name ?? "Unknown party"),
      totalMetres: num(r.total_metres),
      netPayable: num(r.net_payable),
      paymentStatus: String(
        r.payment_status ?? "pending"
      ) as LotOrder["paymentStatus"],
    }));

    const revenue = orders.reduce((sum, o) => sum + o.netPayable, 0);

    return {
      stock,
      lotReportUrl: (lotRow?.lot_report_url as string | null) ?? null,
      costs,
      orders,
      profitability: computeProfitability(stock, costs, revenue),
    };
  } catch {
    return null;
  }
}

/** The user's item master, for the new-lot item dropdown. */
export async function fetchItemMaster(): Promise<ItemMasterEntry[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("item_master")
      .select("id, item_name")
      .eq("user_id", userId)
      .order("item_name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      itemName: String(r.item_name),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

async function uploadToBucket(
  bucket: string,
  userId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  // Unique-ish path without Math.random (matches vitals.addPhoto).
  const stamp = `${Date.now()}-${Math.round(performance.now())}-${file.size}`;
  const path = `${userId}/${stamp}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Creates a lot: uploads the design photo / lot report to Storage, resolves
 * (or inserts) the item-master entry, then inserts the lot row. Returns the
 * new lot's id. Throws on failure so the sheet can surface the error.
 */
export async function createLot(input: NewLotInput): Promise<string> {
  const userId = await ensureAnonymousSession();
  const itemName = input.itemName.trim();

  // Resolve the item id — reuse the picked one, otherwise insert a new master
  // entry. On a name conflict (typed an existing name), fall back to a lookup.
  let itemId = input.itemId;
  if (!itemId && itemName) {
    const { data, error } = await supabase
      .from("item_master")
      .insert({ user_id: userId, item_name: itemName })
      .select("id")
      .single();
    if (!error && data) {
      itemId = String(data.id);
    } else {
      const { data: existing } = await supabase
        .from("item_master")
        .select("id")
        .eq("user_id", userId)
        .eq("item_name", itemName)
        .maybeSingle();
      itemId = existing ? String(existing.id) : null;
    }
  }

  const [designPhotoUrl, lotReportUrl] = await Promise.all([
    input.designPhoto
      ? uploadToBucket(PHOTO_BUCKET, userId, input.designPhoto)
      : Promise.resolve(null),
    input.lotReport
      ? uploadToBucket(REPORT_BUCKET, userId, input.lotReport)
      : Promise.resolve(null),
  ]);

  const { data, error } = await supabase
    .from("lots")
    .insert({
      user_id: userId,
      item_id: itemId,
      item_name: itemName || null,
      d_no: input.dNo.trim() || null,
      design_photo_url: designPhotoUrl,
      lot_report_url: lotReportUrl,
      top_opening_stock: input.topMetres,
      bottom_opening_stock: input.bottomMetres,
      dupatta_opening_stock: input.dupattaMetres,
      top_cost_per_metre: input.topCost,
      bottom_cost_per_metre: input.bottomCost,
      dupatta_cost_per_metre: input.dupattaCost,
      low_stock_threshold_metres: input.threshold,
      status: "arrived" satisfies LotStatus,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't save the lot.");

  return String(data.id);
}
