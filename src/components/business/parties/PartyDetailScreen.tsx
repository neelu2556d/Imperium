"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { rupees } from "../orders/orderFormat";
import { useSheet } from "@/lib/useSheet";
import type { PartyProfile, PartyRateCardEntry, PartyOrder, OutstandingInvoice } from "@/lib/supabase/parties";
import {
  fetchPartyProfile,
  fetchPartyRateCards,
  fetchOutstandingInvoices,
  fetchPartyOrders,
  updateParty,
  upsertRateCard,
  deleteParty,
} from "@/lib/supabase/parties";
import EditRateSheet from "./EditRateSheet";

/** Stats for the party stats section. */
interface PartyStatsData {
  totalOrders: number;
  totalValue: number;
  avgOrderValue: number;
  avgMetresPerOrder: number;
  avgPaymentDays: number;
  lastOrderDaysAgo: number;
}

/**
 * Party detail screen with all sections:
 * - Profile card
 * - Rate Cards section
 * - Outstanding section
 * - Order History section
 * - Party Stats section
 */
export default function PartyDetailScreen({
  partyId,
}: {
  partyId: string;
}) {
  const router = useRouter();
  const [party, setParty] = useState<PartyProfile | null | undefined>(undefined);
  const [rateCards, setRateCards] = useState<PartyRateCardEntry[] | null>(null);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[] | null>(null);
  const [orders, setOrders] = useState<PartyOrder[] | null>(null);
  const [stats, setStats] = useState<PartyStatsData | null | undefined>(undefined);
  const [editingCard, setEditingCard] = useState<PartyRateCardEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load all data
  const loadData = useCallback(async () => {
    const [partyData, rateCardsData, invoicesData, ordersData] = await Promise.all([
      fetchPartyProfile(partyId),
      fetchPartyRateCards(partyId),
      fetchOutstandingInvoices(partyId),
      fetchPartyOrders(partyId),
    ]);

    setParty(partyData);
    setRateCards(rateCardsData);
    setOutstandingInvoices(invoicesData);
    setOrders(ordersData);
    setStats(computeStats(ordersData, partyData));
  }, [partyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasOutstanding = outstandingInvoices?.some((inv) => inv.balance > 0);
  const totalOutstanding = outstandingInvoices?.reduce((sum, inv) => sum + inv.balance, 0) ?? 0;

  // Back button
  const handleBack = () => router.back();

  // Handle rate card update
  const handleRateCardSave = async (rates: { topRate: number; bottomRate: number; dupattaRate: number }) => {
    if (!editingCard || !editingCard.itemId) return;
    try {
      await upsertRateCard(partyId, editingCard.itemId, rates);
      // Refresh rate cards
      const updatedCards = await fetchPartyRateCards(partyId);
      setRateCards(updatedCards);
      setEditingCard(null);
    } catch {
      // Error shown in sheet
    }
  };

  // Handle delete party
  const handleDelete = async () => {
    if (!party) return;
    try {
      await deleteParty(party.id);
      router.push("/business/parties");
    } catch {
      // Error shown in confirm dialog
    }
  };

  if (party === undefined) {
    return (
      <div className="flex h-screen items-center justify-center px-5">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (party === null) {
    return (
      <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
        <button
          type="button"
          onClick={handleBack}
          className="mono flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em] text-muted"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <p className="mt-8 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          Couldn't load this party.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      {/* Back button + party name */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="mono flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em] text-muted hover:text-fg"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          data-no-vitality
          onClick={() => router.push(`/business/parties/${party.id}/edit`)}
          className="rounded-full p-2 hover:bg-white/[0.05]"
          aria-label="Edit party"
        >
          <Pencil size={18} className="text-muted" />
        </button>
      </div>

      <h2 className="serif-italic mt-2 text-2xl md:text-3xl" data-no-vitality>
        {party.partyName}
      </h2>

      {/* Profile Card */}
      <section className="mt-6 rounded-xl border border-border bg-bg-elevated p-4">
        <h3 className="mono mb-3 text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Party Profile
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-fg">{party.partyName}</span>
            {party.area && <span className="text-muted">· {party.area}</span>}
            {party.city && <span className="text-muted">· {party.city}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
            <span>
              Default payment days:{" "}
              <span className="font-medium text-fg">{party.defaultPaymentDays} days</span>
            </span>
            <span>
              CD: <span className="font-medium text-fg">{party.cdPercent}%</span>
            </span>
            <span>
              GST:{" "}
              <span className="font-medium text-fg">
                {party.gstPreference === "gst" ? "GST" : "Non-GST"}
              </span>
            </span>
          </div>
          {party.notes && (
            <div className="mt-2 rounded-lg bg-white/[0.03] p-2 text-sm text-muted">
              {party.notes}
            </div>
          )}
        </div>
      </section>

      {/* Rate Cards Section */}
      <section className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
            Saved Rates
          </h3>
        </div>

        {rateCards === null || rateCards.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            No rate cards saved yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rateCards.map((card) => (
              <li key={card.id} className="rounded-xl border border-border bg-bg-elevated p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-fg">{card.itemName ?? "Unknown item"}</p>
                    <p className="mono mt-1 text-[0.7rem] text-muted">
                      Last updated: {shortDate(card.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCard(card)}
                    className="mono rounded-lg border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] transition-colors"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                    }}
                  >
                    Edit rates
                  </button>
                </div>

                {/* Rates display */}
                <div className="mt-3 grid grid-cols-3 gap-3 text-[0.72rem] tabular-nums text-muted">
                  {card.topRate !== null && (
                    <div>
                      <span className="block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                        Top
                      </span>
                      <span className="text-fg">₹{card.topRate}/m</span>
                    </div>
                  )}
                  {card.bottomRate !== null && (
                    <div>
                      <span className="block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                        Bottom
                      </span>
                      <span className="text-fg">₹{card.bottomRate}/m</span>
                    </div>
                  )}
                  {card.dupattaRate !== null && (
                    <div>
                      <span className="block text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                        Dupatta
                      </span>
                      <span className="text-fg">₹{card.dupattaRate}/m</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outstanding Section */}
      <section className="mt-4">
        <h3 className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Outstanding
        </h3>

        <div className="mt-2 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="flex items-end justify-between">
            <span className="text-muted">
              Total outstanding:{" "}
              <span
                className={`text-2xl font-semibold ${
                  hasOutstanding ? "text-[var(--color-amber)]" : "text-fg"
                }`}
              >
                {rupees(totalOutstanding)}
              </span>
            </span>
            {hasOutstanding && (
              <span
                className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                style={{
                  color: "var(--color-amber)",
                  borderColor: "var(--color-amber)",
                }}
              >
                {outstandingInvoices?.filter((i) => i.balance > 0).length} invoices
              </span>
            )}
          </div>

          {/* Pending invoices list */}
          {outstandingInvoices && outstandingInvoices.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {outstandingInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 text-[0.72rem] text-muted">
                    <span className="tabular-nums">{shortDate(invoice.orderDate)}</span>
                    <span className="text-fg">· {invoice.dNo || "—"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[0.72rem] tabular-nums text-muted">
                    <span className="font-medium text-fg">{rupees(invoice.balance)}</span>
                    <span className="text-muted">
                      Due: {shortDate(invoice.dueDate)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] ${
                        invoice.status === "overdue"
                          ? "border border-[var(--color-danger)] text-[var(--color-danger)]"
                          : invoice.status === "partial"
                          ? "border border-[var(--color-amber)] text-[var(--color-amber)]"
                          : "border border-border text-muted"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-center text-sm text-muted">No outstanding invoices.</p>
          )}
        </div>
      </section>

      {/* Order History Section */}
      <section className="mt-4">
        <h3 className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Order History
        </h3>

        {orders === null || orders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            No orders yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-elevated">
            <table className="w-full text-sm">
              <thead>
                <tr className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-4 py-3 text-left font-normal">Date</th>
                  <th className="px-4 py-3 text-left font-normal">Item</th>
                  <th className="px-4 py-3 text-right font-normal">Metres</th>
                  <th className="px-4 py-3 text-right font-normal">Amount</th>
                  <th className="px-4 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const statusColor =
                    order.status === "overdue"
                      ? "var(--color-danger)"
                      : order.status === "paid"
                      ? "var(--accent)"
                      : order.status === "partial"
                      ? "var(--color-amber)"
                      : "var(--color-muted-strong)";
                  return (
                    <tr
                      key={order.id}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-white/[0.03]"
                      onClick={() => {
                        // Open order detail - would need order detail sheet
                        console.log("Open order", order.id);
                      }}
                    >
                      <td className="mono px-4 py-3 text-left text-muted-strong tabular-nums">
                        {shortDate(order.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-left text-fg">
                        <span className="truncate">{order.itemName || "—"}</span>
                        {order.dNo ? (
                          <span className="mono ml-1.5 text-[0.68rem] text-muted">{order.dNo}</span>
                        ) : null}
                      </td>
                      <td className="mono px-4 py-3 text-right tabular-nums text-muted-strong">
                        {Math.round(order.totalMetres).toLocaleString("en-IN")}m
                      </td>
                      <td className="mono px-4 py-3 text-right font-semibold tabular-nums text-fg">
                        {rupees(order.netPayable)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="mono inline-block rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                          style={{ color: statusColor, borderColor: statusColor }}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Party Stats Section */}
      <section className="mt-4">
        <h3 className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Party Stats
        </h3>

        {stats == null ? (
          <div className="mt-3 h-32 animate-pulse rounded-xl border border-border bg-bg-elevated" />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-border bg-bg-elevated p-4">
            <StatItem label="Total orders" value={stats!.totalOrders.toString()} />
            <StatItem label="Total value" value={rupees(stats!.totalValue)} />
            <StatItem label="Avg order value" value={rupees(stats!.avgOrderValue)} />
            <StatItem label="Avg metres/order" value={`${Math.round(stats!.avgMetresPerOrder).toLocaleString("en-IN")}m`} />
            <StatItem label="Avg payment days" value={Math.round(stats!.avgPaymentDays).toString()} />
            <StatItem label="Last order" value={`${stats!.lastOrderDaysAgo} days ago`} />
          </div>
        )}
      </section>

      {/* Edit rate card sheet */}
      {editingCard && (
        <EditRateSheet
          card={editingCard}
          onSave={handleRateCardSave}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Delete confirmation sheet */}
      {showDeleteConfirm && (
        <DeleteConfirmSheet
          partyName={party.partyName}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// Helper to compute stats from orders
function computeStats(
  orders: PartyOrder[] | null,
  party: PartyProfile | null
): PartyStatsData {
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      totalValue: 0,
      avgOrderValue: 0,
      avgMetresPerOrder: 0,
      avgPaymentDays: party?.defaultPaymentDays ?? 0,
      lastOrderDaysAgo: 0,
    };
  }

  const totalOrders = orders.length;
  const totalValue = orders.reduce((sum, o) => sum + o.netPayable, 0);
  const totalMetres = orders.reduce((sum, o) => sum + o.totalMetres, 0);

  // Calculate average payment days from actual orders
  const daysSum = orders.reduce((sum, o) => sum + (o.paymentDays || 0), 0);
  const avgPaymentDays = daysSum / totalOrders;

  // Calculate last order days ago
  const latestOrder = orders[0]; // Already sorted by order_date DESC
  const lastOrderDate = new Date(latestOrder.orderDate);
  const now = new Date();
  const lastOrderDaysAgo = Math.floor((now.getTime() - lastOrderDate.getTime()) / 86_400_000);

  return {
    totalOrders,
    totalValue,
    avgOrderValue: totalValue / totalOrders,
    avgMetresPerOrder: totalMetres / totalOrders,
    avgPaymentDays,
    lastOrderDaysAgo,
  };
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mono text-[0.8rem] font-semibold text-fg">{value}</p>
    </div>
  );
}

function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Delete confirm bottom sheet
function DeleteConfirmSheet({
  partyName,
  onCancel,
  onConfirm,
}: {
  partyName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { backdropClassName, panelClassName, panelRef, panelStyle, handleProps, handleStyle, close } = useSheet(onCancel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`relative flex h-[40dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="Confirm delete"
      >
        <div className="shrink-0 px-6 pt-6">
          <div
            className="mx-auto mb-4 h-1 w-10 rounded-full"
            style={{ background: "var(--color-border-strong)", ...handleStyle }}
            aria-hidden
            {...handleProps}
          />
          <h2 className="serif-italic text-2xl" data-no-vitality>
            Delete party?
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <p className="text-sm text-muted">
            Are you sure you want to delete <strong className="text-fg">{partyName}</strong>? This
            action cannot be undone. All orders and data for this party will be removed.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              data-no-vitality
              onClick={close}
              className="rounded-full border px-5 py-3 text-sm font-medium"
              style={{
                borderColor: "var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-muted-strong)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg px-5 py-3 text-sm font-medium transition-colors"
              style={{ background: "var(--color-danger)", color: "#fff" }}
            >
              Delete Party
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
