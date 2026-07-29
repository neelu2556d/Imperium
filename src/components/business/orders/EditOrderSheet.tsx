"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import {
  updateOrder,
  type OrderRow,
  type PaymentStatus,
} from "@/lib/supabase/orders";
import { rupees } from "./orderFormat";

const PAYMENT_OPTIONS: Array<{ key: PaymentStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "partial", label: "Partial" },
  { key: "overdue", label: "Overdue" },
];

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "var(--radius-sm)",
} as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Bottom sheet for editing an order's payment status, received amount, rates,
 * discount, and payment terms. Pre-filled from the existing `OrderRow` data.
 * On save, calls `updateOrder` and notifies the parent.
 */
export default function EditOrderSheet({
  order,
  onClose,
  onSaved,
}: {
  order: OrderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    backdropClassName,
    panelClassName,
    panelRef,
    panelStyle,
    handleProps,
    handleStyle,
    close,
  } = useSheet(onClose);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order.status);
  const [amountReceived, setAmountReceived] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {
        paymentStatus,
      };

      const amt = amountReceived.trim();
      if (amt) {
        updates.amountReceived = toNum(amt);
      }

      await updateOrder(order.id, updates as any);
      pushToast(`${order.partyName} — order updated.`);
      onSaved();
    } catch {
      setError("Couldn't save changes. Check your connection and try again.");
      setSaving(false);
    }
  };

  const color = (() => {
    switch (paymentStatus) {
      case "paid": return "var(--accent)";
      case "overdue": return "var(--color-danger)";
      case "partial": return "var(--color-amber)";
      default: return "var(--color-muted-strong)";
    }
  })();

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
        className={`relative flex h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="Edit order"
      >
        <div className="shrink-0 px-6 pt-6">
          <div
            className="mx-auto mb-4 h-1 w-10 rounded-full"
            style={{ background: "var(--color-border-strong)", ...handleStyle }}
            aria-hidden
            {...handleProps}
          />
          <div className="flex items-baseline justify-between">
            <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              Edit order
            </p>
            <button
              type="button"
              data-no-vitality
              onClick={close}
              className="mono border-0 bg-transparent p-1 text-[0.7rem] uppercase tracking-[0.1em] text-muted"
            >
              Cancel
            </button>
          </div>
          <h2 className="serif-italic mt-1 text-2xl" data-no-vitality>
            {order.partyName}
          </h2>
          <p className="mono mt-0.5 text-[0.68rem] text-muted">
            {order.itemName}
            {order.dNo ? ` · ${order.dNo}` : ""}
          </p>
          <p className="mono mt-4 text-[0.7rem] text-muted">
            Amount: {rupees(order.netPayable)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
          <div className="flex flex-col gap-5">
            {/* Payment Status */}
            <Field label="Payment status">
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map(({ key, label }) => {
                  const active = paymentStatus === key;
                  const optionColor = (() => {
                    switch (key) {
                      case "paid": return "var(--accent)";
                      case "overdue": return "var(--color-danger)";
                      case "partial": return "var(--color-amber)";
                      default: return "var(--color-muted-strong)";
                    }
                  })();
                  return (
                    <button
                      key={key}
                      type="button"
                      data-no-vitality
                      aria-pressed={active}
                      onClick={() => setPaymentStatus(key)}
                      className="rounded-full border px-3 py-2 text-[0.78rem] font-medium transition-colors"
                      style={
                        active
                          ? {
                              background: optionColor,
                              color: key === "overdue" ? "#fff" : "var(--accent-ink)",
                              borderColor: optionColor,
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
            </Field>

            {/* Amount Received */}
            <Field label="Amount received (₹)">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={amountReceived}
                placeholder="e.g. 50000"
                onChange={(e) => setAmountReceived(e.target.value)}
                className="mono w-full tabular-nums"
                data-no-vitality
                style={inputStyle}
              />
              <p className="mt-1 text-[0.72rem] text-muted">
                Set the total received so far. The status will auto-update if fully paid.
              </p>
            </Field>

            {error && (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn-primary w-full"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
