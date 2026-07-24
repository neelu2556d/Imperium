import type { PaymentStatus } from "@/lib/supabase/orders";
export { type PaymentStatus };

/** ₹ with Indian digit grouping; whole rupees (paise aren't tracked here). */
export const rupees = (n: number): string =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Metres, rounded, Indian grouping. */
export const metres = (n: number): string =>
  `${Math.round(n).toLocaleString("en-IN")}m`;

/** DD/MM/YYYY for due dates and the success toast. */
export function ddmmyyyy(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "12 Jul" style short date for the list rows. */
export function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partial",
};

/**
 * Status pill colour per the spec: pending amber, overdue danger, paid mint,
 * partial muted. Border-only pills use the same colour for text + border.
 */
export function statusColor(status: PaymentStatus): string {
  switch (status) {
    case "overdue":
      return "var(--color-danger)";
    case "paid":
      return "var(--accent)";
    case "partial":
      return "var(--color-muted-strong)";
    default:
      return "var(--color-amber)";
  }
}
