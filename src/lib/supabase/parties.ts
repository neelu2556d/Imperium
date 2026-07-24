import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Local YYYY-MM-DD (matches how order_date is stored). */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** One row in the parties list. */
export interface PartyRow {
  id: string;
  partyName: string;
  area: string | null;
  city: string | null;
  totalOrders: number;
  totalSaleValue: number;
  outstandingAmount: number;
}

/** Full party profile with all details. */
export interface PartyProfile {
  id: string;
  partyName: string;
  area: string | null;
  city: string | null;
  defaultPaymentDays: number;
  cdPercent: number;
  gstPreference: "gst" | "non_gst";
  notes: string | null;
  createdAt: string;
}

/** One rate card entry for a party + item pair. */
export interface PartyRateCardEntry {
  id: string;
  itemId: string | null;
  itemName: string | null;
  topRate: number | null;
  bottomRate: number | null;
  dupattaRate: number | null;
  updatedAt: string;
}

/** One pending invoice for the outstanding section. */
export interface OutstandingInvoice {
  id: string;
  orderDate: string;
  dNo: string | null;
  netPayable: number;
  amountReceived: number;
  balance: number;
  dueDate: string;
  paymentDays: number;
  daysOverdue: number;
  status: "pending" | "partial" | "overdue";
}

/** One order row for the order history. */
export interface PartyOrder {
  id: string;
  orderDate: string;
  itemName: string | null;
  dNo: string | null;
  totalMetres: number;
  totalAmount: number;
  netPayable: number;
  amountReceived: number;
  balance: number;
  paymentDays: number;
  status: "pending" | "paid" | "partial" | "overdue";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stats for a party (used in batch fetch). */
export interface PartyStats {
  totalOrders: number;
  totalSaleValue: number;
  outstandingAmount: number;
}

/** Rate card for a party + item pair. */
export interface PartyRateCard {
  topRate: number | null;
  bottomRate: number | null;
  dupattaRate: number | null;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Every party, sorted by name. */
export async function fetchAllParties(): Promise<PartyRow[]> {
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

    const parties = data ?? [];

    // Fetch stats for each party in parallel
    const partyIds = parties.map((p) => String(p.id));
    const stats = await fetchPartyStatsBatch(partyIds, userId);

    return parties.map((p) => {
      const statsForParty = stats.get(String(p.id)) ?? {
        totalOrders: 0,
        totalSaleValue: 0,
        outstandingAmount: 0,
      };
      return {
        id: String(p.id),
        partyName: String(p.party_name),
        area: (p.area as string | null) ?? null,
        city: (p.city as string | null) ?? null,
        totalOrders: statsForParty.totalOrders,
        totalSaleValue: statsForParty.totalSaleValue,
        outstandingAmount: statsForParty.outstandingAmount,
      };
    });
  } catch {
    return [];
  }
}

/** Fetch stats for multiple parties in a single query. */
async function fetchPartyStatsBatch(
  partyIds: string[],
  userId: string
): Promise<Map<string, PartyStats>> {
  if (partyIds.length === 0) {
    return new Map();
  }

  const stats = new Map<string, PartyStats>();

  try {
    // Fetch order stats
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("party_id, total_amount, net_payable, amount_received, payment_status")
      .eq("user_id", userId)
      .in("party_id", partyIds);
    if (!ordersError && ordersData) {
      for (const row of ordersData) {
        const partyId = String(row.party_id ?? "");
        if (!partyId) continue;

        if (!stats.has(partyId)) {
          stats.set(partyId, {
            totalOrders: 0,
            totalSaleValue: 0,
            outstandingAmount: 0,
          });
        }

        const s = stats.get(partyId)!;
        s.totalOrders += 1;
        s.totalSaleValue += num(row.total_amount);
        if (
          row.payment_status === "pending" ||
          row.payment_status === "overdue" ||
          row.payment_status === "partial"
        ) {
          s.outstandingAmount += num(row.net_payable) - num(row.amount_received);
        }
      }
    }
  } catch {
    // Return partial results on error
  }

  return stats;
}

/** One party's full profile. */
export async function fetchPartyProfile(
  partyId: string
): Promise<PartyProfile | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("party_master")
      .select("*")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) return null;

    return {
      id: String(data.id),
      partyName: String(data.party_name),
      area: (data.area as string | null) ?? null,
      city: (data.city as string | null) ?? null,
      defaultPaymentDays: num(data.default_payment_days),
      cdPercent: num(data.cd_percent),
      gstPreference: data.gst_preference === "gst" ? "gst" : "non_gst",
      notes: (data.notes as string | null) ?? null,
      createdAt: String(data.created_at),
    };
  } catch {
    return null;
  }
}

/** Rate cards saved for this party (items they've ordered). */
export async function fetchPartyRateCards(
  partyId: string
): Promise<PartyRateCardEntry[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("party_rate_cards")
      .select(
        "id, item_id, item_master(item_name), top_rate, bottom_rate, dupatta_rate, updated_at"
      )
      .eq("user_id", userId)
      .eq("party_id", partyId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: String(r.id),
      itemId: r.item_id as string | null,
      itemName: (r as Record<string, unknown> as { item_master?: { item_name?: string } }).item_master?.item_name ?? null,
      topRate: r.top_rate == null ? null : num(r.top_rate),
      bottomRate: r.bottom_rate == null ? null : num(r.bottom_rate),
      dupattaRate: r.dupatta_rate == null ? null : num(r.dupatta_rate),
      updatedAt: String(r.updated_at),
    }));
  } catch {
    return [];
  }
}

/** Outstanding invoices for this party (pending/partial/overdue orders). */
export async function fetchOutstandingInvoices(
  partyId: string
): Promise<OutstandingInvoice[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_date, d_no, net_payable, amount_received, due_date, payment_days, payment_status"
      )
      .eq("user_id", userId)
      .eq("party_id", partyId)
      .in("payment_status", ["pending", "partial", "overdue"])
      .order("due_date", { ascending: true });
    if (error) throw error;

    const now = new Date();
    return (data ?? []).map((r) => {
      const netPayable = num(r.net_payable);
      const amountReceived = num(r.amount_received);
      const balance = netPayable - amountReceived;
      const daysOverdue = r.due_date
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(`${r.due_date}T00:00:00`).getTime()) /
                86_400_000
            )
          )
        : 0;

      return {
        id: String(r.id),
        orderDate: String(r.order_date ?? ""),
        dNo: (r.d_no as string | null) ?? null,
        netPayable,
        amountReceived,
        balance,
        dueDate: String(r.due_date ?? ""),
        paymentDays: num(r.payment_days),
        daysOverdue,
        status: String(r.payment_status) as "pending" | "partial" | "overdue",
      };
    });
  } catch {
    return [];
  }
}

/** Order history for this party. */
export async function fetchPartyOrders(
  partyId: string
): Promise<PartyOrder[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_date, item_name, d_no, total_metres, total_amount, net_payable, amount_received, payment_days, payment_status"
      )
      .eq("user_id", userId)
      .eq("party_id", partyId)
      .order("order_date", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: String(r.id),
      orderDate: String(r.order_date ?? ""),
      itemName: (r.item_name as string | null) ?? null,
      dNo: (r.d_no as string | null) ?? null,
      totalMetres: num(r.total_metres),
      totalAmount: num(r.total_amount),
      netPayable: num(r.net_payable),
      amountReceived: num(r.amount_received),
      balance: num(r.net_payable) - num(r.amount_received),
      paymentDays: num(r.payment_days),
      status: String(r.payment_status) as "pending" | "paid" | "partial" | "overdue",
    }));
  } catch {
    return [];
  }
}

/** Party stats summary. */
export async function fetchPartyStats(
  partyId: string
): Promise<PartyStats | null> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, total_metres, net_payable, payment_status")
      .eq("user_id", userId)
      .eq("party_id", partyId);
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return null;

    let totalOrders = 0;
    let totalValue = 0;
    let totalMetres = 0;

    for (const row of rows) {
      totalOrders += 1;
      totalValue += num(row.total_amount);
      totalMetres += num(row.total_metres);
    }

    return {
      totalOrders,
      totalSaleValue: totalValue,
      outstandingAmount: 0, // Will be calculated from orders
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/** Input for adding/editing a party. */
export interface PartyInput {
  partyName: string;
  area: string | null;
  city: string | null;
  defaultPaymentDays: number;
  cdPercent: number;
  gstPreference: "gst" | "non_gst";
  notes: string | null;
}

/** Create a new party. */
export async function createParty(input: PartyInput): Promise<string> {
  const userId = await ensureAnonymousSession();
  const { data, error } = await supabase
    .from("party_master")
    .insert({
      user_id: userId,
      party_name: input.partyName.trim(),
      area: input.area?.trim() || null,
      city: input.city?.trim() || null,
      default_payment_days: input.defaultPaymentDays,
      cd_percent: input.cdPercent,
      gst_preference: input.gstPreference,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Couldn't create the party.");
  }
  return String(data.id);
}

/** Update an existing party. */
export async function updateParty(
  partyId: string,
  input: PartyInput
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("party_master")
    .update({
      party_name: input.partyName.trim(),
      area: input.area?.trim() || null,
      city: input.city?.trim() || null,
      default_payment_days: input.defaultPaymentDays,
      cd_percent: input.cdPercent,
      gst_preference: input.gstPreference,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", partyId);

  if (error) {
    throw error;
  }
}

/** Upsert a rate card for a party + item pair. */
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

/** Delete a party. */
export async function deleteParty(partyId: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const { error } = await supabase
    .from("party_master")
    .delete()
    .eq("user_id", userId)
    .eq("id", partyId);

  if (error) {
    throw error;
  }
}
