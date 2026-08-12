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

/** Local YYYY-MM-DD (matches how lots.date_arrived is stored). */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  dateArrived: string;
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
// Writers — create
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

  // A back-dated lot shouldn't sit in "arrived" forever: run the same status
  // rule the SQL trigger applies once an order lands, so an old arrival gets
  // its age-based status immediately (e.g. dead_stock when stock is high).
  const dateArrived = input.dateArrived || localISODate(new Date());
  const status: LotStatus =
    dateArrived === localISODate(new Date())
      ? "arrived"
      : computeLotStatus({
          topRemaining: input.topMetres,
          bottomRemaining: input.bottomMetres,
          dupattaRemaining: input.dupattaMetres,
          threshold: input.threshold,
          dateArrived,
        });

  const { data, error } = await supabase
    .from("lots")
    .insert({
      user_id: userId,
      item_id: itemId,
      item_name: itemName || null,
      d_no: input.dNo.trim() || null,
      design_photo_url: designPhotoUrl,
      lot_report_url: lotReportUrl,
      date_arrived: dateArrived,
      top_opening_stock: input.topMetres,
      bottom_opening_stock: input.bottomMetres,
      dupatta_opening_stock: input.dupattaMetres,
      top_cost_per_metre: input.topCost,
      bottom_cost_per_metre: input.bottomCost,
      dupatta_cost_per_metre: input.dupattaCost,
      low_stock_threshold_metres: input.threshold,
      status,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't save the lot.");

  return String(data.id);
}

// ---------------------------------------------------------------------------
// Status recompute — mirrors the SQL CASE branch order in 0017_business_tab.sql
// (cleared > low_stock > dead_stock > active). Used when a lot is created
// back-dated, when its opening stock / date / threshold change, and when an
// order is moved off it (the DB trigger only rebalances the lot moved onto).
// ---------------------------------------------------------------------------

export interface LotStatusInput {
  topRemaining: number;
  bottomRemaining: number;
  dupattaRemaining: number;
  threshold: number;
  dateArrived: string | null;
}

/** Computes a lot's status from remaining stock and age, mirroring the SQL
 *  `update_lot_status()` trigger exactly. */
export function computeLotStatus(input: LotStatusInput): LotStatus {
  const { topRemaining, bottomRemaining, dupattaRemaining, threshold } = input;
  if (topRemaining <= 0 && bottomRemaining <= 0 && dupattaRemaining <= 0) {
    return "cleared";
  }
  if (
    topRemaining < threshold ||
    bottomRemaining < threshold ||
    dupattaRemaining < threshold
  ) {
    return "low_stock";
  }
  if (input.dateArrived) {
    const arrived = new Date(`${input.dateArrived}T00:00:00`);
    const daysSince = Math.max(
      0,
      Math.floor((Date.now() - arrived.getTime()) / 86_400_000)
    );
    if (daysSince > 45 && topRemaining > threshold) return "dead_stock";
  }
  return "active";
}

/**
 * Re-fetches a lot from stock_register and writes its status from the CASE
 * rule. Best-effort (swallows errors like the other background helpers) — the
 * next order write or list load recomputes anyway.
 */
export async function recomputeLotStatus(lotId: string): Promise<void> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("stock_register")
      .select("*")
      .eq("user_id", userId)
      .eq("lot_id", lotId)
      .maybeSingle();
    if (error || !data) return;
    const status = computeLotStatus({
      topRemaining: num(data.top_remaining),
      bottomRemaining: num(data.bottom_remaining),
      dupattaRemaining: num(data.dupatta_remaining),
      threshold: num(data.low_stock_threshold_metres),
      dateArrived: (data.date_arrived as string | null) ?? null,
    });
    await supabase
      .from("lots")
      .update({ status })
      .eq("user_id", userId)
      .eq("id", lotId);
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Writers — update
// ---------------------------------------------------------------------------

export interface UpdateLotInput {
  itemName?: string;
  dNo?: string;
  designPhoto?: File | null;
  dateArrived?: string;
  topOpeningStock?: number;
  bottomOpeningStock?: number;
  dupattaOpeningStock?: number;
  topCost?: number | null;
  bottomCost?: number | null;
  dupattaCost?: number | null;
  threshold?: number;
  status?: LotStatus;
}

/**
 * Updates an existing lot's editable fields. Returns true on success, throws
 * on failure. Only the supplied fields are changed — omitted fields keep their
 * current values. For the design photo, pass `null` explicitly to clear it,
 * `undefined` to leave it unchanged, or a `File` to upload a replacement.
 *
 * When opening stock, arrival date, or the threshold change (and `status` is
 * not supplied), the lot's status is recomputed client-side from remaining
 * stock + age and written in the same UPDATE, so the stored status always
 * matches what stock_register would report.
 */
export async function updateLot(
  lotId: string,
  input: UpdateLotInput
): Promise<void> {
  const userId = await ensureAnonymousSession();

  const updates: Record<string, unknown> = {};
  const newPhoto = input.designPhoto;

  if (input.itemName !== undefined) updates.item_name = input.itemName.trim();
  if (input.dNo !== undefined) updates.d_no = input.dNo.trim() || null;
  if (input.dateArrived !== undefined) updates.date_arrived = input.dateArrived;
  if (input.topOpeningStock !== undefined) updates.top_opening_stock = input.topOpeningStock;
  if (input.bottomOpeningStock !== undefined) updates.bottom_opening_stock = input.bottomOpeningStock;
  if (input.dupattaOpeningStock !== undefined) updates.dupatta_opening_stock = input.dupattaOpeningStock;
  if (input.topCost !== undefined) updates.top_cost_per_metre = input.topCost;
  if (input.bottomCost !== undefined) updates.bottom_cost_per_metre = input.bottomCost;
  if (input.dupattaCost !== undefined) updates.dupatta_cost_per_metre = input.dupattaCost;
  if (input.threshold !== undefined) updates.low_stock_threshold_metres = input.threshold;
  if (input.status !== undefined) updates.status = input.status;

  // Recompute the status client-side when stock / date / threshold changed and
  // the user didn't set a status explicitly. Read sold figures from the
  // current stock_register row, then fold the new opening stock into the
  // remaining before applying the CASE rule — all in the same UPDATE below.
  const stockChanged =
    input.topOpeningStock !== undefined ||
    input.bottomOpeningStock !== undefined ||
    input.dupattaOpeningStock !== undefined ||
    input.dateArrived !== undefined ||
    input.threshold !== undefined;
  if (stockChanged && input.status === undefined) {
    const { data: sr, error: srError } = await supabase
      .from("stock_register")
      .select(
        "top_opening_stock, bottom_opening_stock, dupatta_opening_stock, top_sold, bottom_sold, dupatta_sold, low_stock_threshold_metres, date_arrived"
      )
      .eq("user_id", userId)
      .eq("lot_id", lotId)
      .maybeSingle();
    if (!srError && sr) {
      updates.status = computeLotStatus({
        topRemaining:
          (input.topOpeningStock ?? num(sr.top_opening_stock)) - num(sr.top_sold),
        bottomRemaining:
          (input.bottomOpeningStock ?? num(sr.bottom_opening_stock)) -
          num(sr.bottom_sold),
        dupattaRemaining:
          (input.dupattaOpeningStock ?? num(sr.dupatta_opening_stock)) -
          num(sr.dupatta_sold),
        threshold: input.threshold ?? num(sr.low_stock_threshold_metres),
        dateArrived:
          input.dateArrived ?? ((sr.date_arrived as string | null) ?? null),
      });
    }
  }

  // Handle design photo upload / clear
  if (newPhoto instanceof File) {
    const url = await uploadToBucket(PHOTO_BUCKET, userId, newPhoto);
    if (url) updates.design_photo_url = url;
  } else if (newPhoto === null) {
    updates.design_photo_url = null;
  }

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("lots")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", lotId);
  if (error) throw error;
}

/**
 * Marks a lot as fully sold out from the user's point of view — flips its
 * status to 'cleared' regardless of what the remaining-stock math says (a lot
 * can hold extra metres the user chooses to move/return, or the stock figures
 * are a single-colour minimum and the last colour is gone). The lot row keeps
 * its opening/sold figures; only the status changes. Throws on failure.
 */
export async function clearLot(lotId: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("lots")
    .update({ status: "cleared" })
    .eq("user_id", userId)
    .eq("id", lotId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Writers — delete
// ---------------------------------------------------------------------------

/**
 * Deletes a lot and its associated Storage files. Throws if the lot has
 * existing orders (the caller should confirm the user wants to proceed).
 * Returns the number of associated orders that will be orphaned.
 */
export async function deleteLot(lotId: string): Promise<{ orderCount: number }> {
  const userId = await ensureAnonymousSession();

  // Check for orders against this lot
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .eq("lot_id", lotId);
  if (orderError) throw orderError;

  const orderCount = (orders ?? []).length;

  // Fetch the lot's storage paths so we can clean up
  const { data: lotRow, error: lotError } = await supabase
    .from("lots")
    .select("design_photo_url, lot_report_url")
    .eq("user_id", userId)
    .eq("id", lotId)
    .maybeSingle();
  if (lotError) throw lotError;

  // Delete from storage (best-effort — don't block the DB delete on this)
  if (lotRow) {
    const paths: string[] = [];
    for (const url of [lotRow.design_photo_url, lotRow.lot_report_url]) {
      if (typeof url === "string" && url.includes(PHOTO_BUCKET + "/")) {
        const parts = url.split(PHOTO_BUCKET + "/")[1];
        if (parts) paths.push(`${userId}/${parts.split("/").pop()}`);
      }
      if (typeof url === "string" && url.includes(REPORT_BUCKET + "/")) {
        const parts = url.split(REPORT_BUCKET + "/")[1];
        if (parts) paths.push(`${userId}/${parts.split("/").pop()}`);
      }
    }
    if (paths.length > 0) {
      await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(paths.filter((p) => p.startsWith(userId)))
        .catch(() => {});
      await supabase.storage
        .from(REPORT_BUCKET)
        .remove(paths.filter((p) => p.startsWith(userId)))
        .catch(() => {});
    }
  }

  // Disconnect orders from this lot (set lot_id to null) so order history survives
  if (orderCount > 0) {
    const { error: updateOrdersError } = await supabase
      .from("orders")
      .update({ lot_id: null })
      .eq("user_id", userId)
      .eq("lot_id", lotId);
    if (updateOrdersError) throw updateOrdersError;
  }

  // Delete the lot row
  const { error: deleteError } = await supabase
    .from("lots")
    .delete()
    .eq("user_id", userId)
    .eq("id", lotId);
  if (deleteError) throw deleteError;

  return { orderCount };
}
