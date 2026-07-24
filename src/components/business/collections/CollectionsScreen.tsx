"use client";

import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/vitals/BottomSheet";
import {
  PAYMENT_LABELS,
  ddmmyyyy,
  rupees,
  shortDate,
  statusColor,
} from "@/components/business/orders/orderFormat";
import type { CollectionRow, PartyLedger, PaymentStatus } from "@/lib/supabase/orders";

type Filter = "all" | "overdue" | "due_week" | "pending" | "paid";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due_week", label: "Due This Week" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
];

const DANGER_DAYS = 0; // overdue
const AMBER_DAYS = 3;
const MINT_DAYS = 7;

/** Days remaining text and color based on days until due. */
function daysRemainingInfo(dueDate: string): { text: string; color: string } {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / 86400000);

  if (diffDays < DANGER_DAYS) {
    return {
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`,
      color: "var(--color-danger)",
    };
  }
  if (diffDays <= DANGER_DAYS) {
    return {
      text: "Due today",
      color: "var(--color-danger)",
    };
  }
  if (diffDays <= AMBER_DAYS) {
    return {
      text: `${diffDays} days`,
      color: "var(--color-amber)",
    };
  }
  if (diffDays <= MINT_DAYS) {
    return {
      text: `${diffDays} days`,
      color: "var(--accent)",
    };
  }
  return {
    text: `${diffDays} days`,
    color: "var(--accent)",
  };
}

/**
 * /business/collections — Payment tracking page.
 * Shows all outstanding orders, allows logging payments, and party ledger summary.
 */
export default function CollectionsScreen() {
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  const [partyLedgers, setPartyLedgers] = useState<PartyLedger[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [openPayment, setOpenPayment] = useState<CollectionRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load collections and party ledgers
  useEffect(() => {
    let cancelled = false;
    fetchCollectionsAndLedgers().then((result) => {
      if (!cancelled) {
        setCollections(result.collections);
        setPartyLedgers(result.ledgers);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Filter collections based on current filter
  const filtered = useMemo(() => {
    if (collections === null) return null;

    switch (filter) {
      case "all":
        return collections;
      case "overdue":
        return collections.filter((c) => c.status === "overdue");
      case "due_week": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);
        return collections.filter((c) => {
          const due = new Date(`${c.dueDate}T00:00:00`);
          return due >= today && due <= oneWeekFromNow;
        });
      }
      case "pending":
        return collections.filter((c) => c.status === "pending");
      case "paid":
        return collections.filter((c) => c.status === "paid");
      default:
        return collections;
    }
  }, [collections, filter]);

  // Summary stats
  const summary = useMemo(() => {
    if (collections === null) return null;

    const totalOutstanding = collections.reduce(
      (sum, c) => sum + c.balance,
      0
    );
    const overdue = collections
      .filter((c) => c.status === "overdue")
      .reduce((sum, c) => sum + c.balance, 0);
    const dueThisWeek = collections
      .filter((c) => {
        const due = new Date(`${c.dueDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);
        return due >= today && due <= oneWeekFromNow && c.status !== "overdue";
      })
      .reduce((sum, c) => sum + c.balance, 0);

    return { totalOutstanding, overdue, dueThisWeek };
  }, [collections]);

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      {/* Top bar */}
      <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
        Collections
      </h2>

      {/* Summary strip */}
      {summary && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <SummaryCard
            label="Total Outstanding"
            value={rupees(summary.totalOutstanding)}
            color="var(--color-danger)"
          />
          <SummaryCard
            label="Overdue"
            value={rupees(summary.overdue)}
            color="var(--color-danger)"
          />
          <SummaryCard
            label="Due This Week"
            value={rupees(summary.dueThisWeek)}
            color="var(--color-amber)"
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-[0.78rem] font-medium transition-colors"
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      borderColor: "var(--accent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--color-muted-strong)",
                      borderColor: "var(--color-border)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Collection rows */}
      {filtered === null ? (
        <ul className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-bg-elevated" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {collections && collections.length === 0
            ? "No pending payments. Every order you log appears here automatically."
            : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} right now.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((order) => (
            <CollectionRowCard
              key={order.id}
              order={order}
              onLogPayment={() => setOpenPayment(order)}
            />
          ))}
        </ul>
      )}

      {/* Party ledger section */}
      {partyLedgers && partyLedgers.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="serif-italic text-xl" data-no-vitality>
            By Party
          </h3>
          <ul className="mt-4 space-y-3">
            {partyLedgers.map((ledger) => (
              <li
                key={ledger.partyId}
                className="rounded-xl border border-border bg-bg-elevated px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-fg">{ledger.partyName}</p>
                  <span
                    className="mono text-[0.78rem] font-semibold tabular-nums"
                    style={{ color: "var(--color-danger)" }}
                  >
                    {rupees(ledger.outstanding)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
                  <div>
                    <span className="block text-muted-strong">Invoiced</span>
                    <span className="block text-right tabular-nums">
                      {rupees(ledger.totalInvoiced)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-strong">Received</span>
                    <span className="block text-right tabular-nums">
                      {rupees(ledger.totalReceived)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-strong">Outstanding</span>
                    <span
                      className="block text-right font-semibold tabular-nums"
                      style={{ color: "var(--color-danger)" }}
                    >
                      {rupees(ledger.outstanding)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Log payment bottom sheet */}
      {openPayment && (
        <LogPaymentSheet
          order={openPayment}
          onClose={() => setOpenPayment(null)}
          onSave={() => {
            setOpenPayment(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Summary card
// ============================================================================

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mono mt-1 text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ============================================================================
// Collection row card
// ============================================================================

function CollectionRowCard({
  order,
  onLogPayment,
}: {
  order: CollectionRow;
  onLogPayment: () => void;
}) {
  const daysInfo = daysRemainingInfo(order.dueDate);
  const isOverdue = order.status === "overdue";

  return (
    <li
      className={`rounded-2xl border px-4 py-4 transition-colors ${
        isOverdue ? "border-danger" : "border-border"
      }`}
      style={{
        background: isOverdue ? "var(--color-danger)/0.05" : "var(--color-card)",
      }}
    >
      {/* Header: party + status */}
      <div className="flex items-center justify-between">
        <p className="truncate text-lg font-medium text-fg">{order.partyName}</p>
        <StatusBadge status={order.status} />
      </div>

      {/* Order details */}
      <p className="mono mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {order.itemName}
        {order.dNo ? ` · ${order.dNo}` : ""}
        <span className="ml-2 text-[0.62rem]">· {shortDate(order.orderDate)}</span>
      </p>

      {/* Invoice info */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-bg-elevated px-3 py-2">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
            Invoice
          </p>
          <p className="mono text-[0.78rem] font-semibold tabular-nums text-fg">
            {rupees(order.netPayable)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
            {order.status === "overdue" ? "Was due" : "Due"}
          </p>
          <p
            className={`mono text-[0.78rem] font-semibold tabular-nums ${
              order.status === "overdue" ? "text-danger" : "text-fg"
            }`}
          >
            {ddmmyyyy(order.dueDate)}
          </p>
        </div>
      </div>

      {/* Days info */}
      <div
        className="mt-2 text-[0.72rem] uppercase tracking-[0.12em] font-medium"
        style={{ color: daysInfo.color }}
      >
        {daysInfo.text}
      </div>

      {/* Log payment button */}
      <button
        type="button"
        onClick={onLogPayment}
        className="mt-3 w-full rounded-lg border border-border py-2 text-[0.72rem] uppercase tracking-[0.12em] font-medium text-muted transition-colors hover:border-mint hover:text-muted-strong"
      >
        Log Payment
      </button>
    </li>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const color = statusColor(status);
  return (
    <span
      className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
      style={{ color, borderColor: color }}
    >
      {PAYMENT_LABELS[status]}
    </span>
  );
}

// ============================================================================
// Log payment bottom sheet
// ============================================================================

function LogPaymentSheet({
  order,
  onClose,
  onSave,
}: {
  order: CollectionRow;
  onClose: () => void;
  onSave: () => void;
}) {
  const [amountReceived, setAmountReceived] = useState<string>(
    order.balance > 0 ? order.balance.toString() : ""
  );
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [cdApplied, setCdApplied] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const cdPercent = order.paymentDays > 0 ? 2 : 0; // Assume 2% CD for payment within terms
  const cdDeduction = (Number(amountReceived || 0) * cdPercent) / 100;
  const netReceived = Number(amountReceived || 0) - cdDeduction;

  async function handleSave() {
    if (!amountReceived || Number(amountReceived) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      await fetch("/api/collection-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amountReceived: Number(amountReceived),
          paymentDate,
          cdApplied,
          notes,
        }),
      });
      onSave();
    } catch (err) {
      alert("Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={`Log Payment — ${order.partyName}`} onClose={onClose}>
      {/* Invoice summary */}
      <div className="mt-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-[0.78rem]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              Order date
            </p>
            <p className="mono mt-1 text-[0.72rem] text-fg">
              {ddmmyyyy(order.orderDate)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              Net payable
            </p>
            <p className="mono mt-1 text-[0.72rem] font-semibold text-fg">
              {rupees(order.netPayable)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              Already received
            </p>
            <p className="mono mt-1 text-[0.72rem] text-muted-strong">
              {rupees(order.amountReceived)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              Balance
            </p>
            <p
              className="mono mt-1 text-[0.72rem] font-semibold text-fg"
              style={{ color: "var(--color-danger)" }}
            >
              {rupees(order.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Amount received */}
      <div className="mt-4">
        <label className="block text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          Amount received
        </label>
        <div className="mt-2 flex items-center rounded-lg border border-border bg-bg-elevated px-3 py-2">
          <span className="mono text-[0.78rem] text-muted mr-2">₹</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-right text-[1.1rem] font-semibold text-fg focus:outline-none"
          />
        </div>
      </div>

      {/* Payment date */}
      <div className="mt-4">
        <label className="block text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          Payment date
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-[0.78rem] text-fg"
        />
      </div>

      {/* CD toggle */}
      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[0.78rem] text-muted">
          <input
            type="checkbox"
            checked={cdApplied}
            onChange={(e) => setCdApplied(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-mint"
          />
          CD applied?
        </label>
      </div>

      {/* CD deduction display */}
      {cdApplied && (
        <div className="mt-2 rounded-lg bg-bg-elevated px-3 py-2 text-[0.72rem]">
          <p className="text-muted">
            CD deduction: <span className="font-medium">{rupees(cdDeduction)}</span> ({cdPercent}% of {rupees(Number(amountReceived || 0))})
          </p>
          <p className="mt-1 font-semibold">
            Net received after CD: <span className="font-bold">{rupees(netReceived)}</span>
          </p>
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <label className="block text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter any notes..."
          className="mt-2 w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-[0.78rem] text-fg focus:outline-none"
          rows={2}
        />
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full rounded-lg bg-mint px-4 py-3 text-[0.78rem] font-semibold text-white shadow-lg shadow-mint/20 hover:bg-mint/90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Confirm Payment"}
      </button>
    </BottomSheet>
  );
}

// ============================================================================
// Data helpers
// ============================================================================

async function fetchCollectionsAndLedgers() {
  try {
    const { ensureAnonymousSession, supabase } = await import("@/lib/supabase/client");
    await ensureAnonymousSession();
    await supabase.rpc("refresh_overdue_orders");
  } catch {
    // Ignore - we'll still try to fetch data
  }

  const { fetchCollectionsRows, fetchPartyLedgers } = await import(
    "@/lib/supabase/orders"
  );
  const [collections, ledgers] = await Promise.all([
    fetchCollectionsRows(),
    fetchPartyLedgers(),
  ]);

  return { collections, ledgers };
}
