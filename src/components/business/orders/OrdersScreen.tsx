"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { fetchAllOrders, type OrderRow } from "@/lib/supabase/orders";
import OrderDetailSheet from "./OrderDetailSheet";
import { PAYMENT_LABELS, metres, rupees, shortDate, statusColor } from "./orderFormat";

type Range = "all" | "today" | "week" | "month";

const RANGES: Array<{ key: Range; label: string }> = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

/** Local YYYY-MM-DD, matching how order_date is stored. */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive lower bound (YYYY-MM-DD) for a range, or null for "all". */
function rangeStart(range: Range): string | null {
  const now = new Date();
  if (range === "today") return localISODate(now);
  if (range === "month") {
    return localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  if (range === "week") {
    // Monday-based week start.
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    return localISODate(monday);
  }
  return null;
}

/**
 * /business/orders — the orders list. Heading + "+ Log Order", a date-range
 * filter row, a search box (party or item name), and the orders table (cards
 * on mobile). Tapping a row opens the detail bottom sheet.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [query, setQuery] = useState("");
  const [openOrder, setOpenOrder] = useState<OrderRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllOrders().then((data) => {
      if (!cancelled) setOrders(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (orders === null) return null;
    const start = rangeStart(range);
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (start && o.orderDate < start) return false;
      if (
        q &&
        !o.partyName.toLowerCase().includes(q) &&
        !o.itemName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, range, query]);

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Orders
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push("/business/orders/new")}
        >
          <Plus size={15} aria-hidden />
          Log Order
        </button>
      </div>

      {/* date-range filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {RANGES.map(({ key, label }) => {
          const active = range === key;
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => setRange(key)}
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

      {/* search */}
      <div className="relative mt-3">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search party or item"
          className="w-full pl-9"
          data-no-vitality
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: "var(--radius-sm)",
          }}
        />
      </div>

      {visible === null ? (
        <ul className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {orders && orders.length === 0
            ? "No orders yet. Log your first with + Log Order."
            : "No orders match this filter."}
        </p>
      ) : (
        <OrdersList orders={visible} onOpen={setOpenOrder} />
      )}

      {openOrder && (
        <OrderDetailSheet
          order={openOrder}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List — a real table on md+, stacked cards on mobile
// ---------------------------------------------------------------------------

function OrdersList({
  orders,
  onOpen,
}: {
  orders: OrderRow[];
  onOpen: (o: OrderRow) => void;
}) {
  return (
    <>
      {/* desktop table */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-bg-elevated md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              <th className="px-4 py-3 text-left font-normal">Date</th>
              <th className="px-4 py-3 text-left font-normal">Party</th>
              <th className="px-4 py-3 text-left font-normal">Item</th>
              <th className="px-4 py-3 text-right font-normal">Metres</th>
              <th className="px-4 py-3 text-right font-normal">Amount</th>
              <th className="px-4 py-3 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const color = statusColor(o.status);
              return (
                <tr
                  key={o.id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-white/[0.03]"
                  onClick={() => onOpen(o)}
                >
                  <td className="mono px-4 py-3 text-left text-muted-strong tabular-nums">
                    {shortDate(o.orderDate)}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-left font-medium text-fg">
                    {o.partyName}
                  </td>
                  <td className="px-4 py-3 text-left text-muted-strong">
                    <span className="truncate">{o.itemName}</span>
                    {o.dNo ? (
                      <span className="mono ml-1.5 text-[0.68rem] text-muted">
                        {o.dNo}
                      </span>
                    ) : null}
                  </td>
                  <td className="mono px-4 py-3 text-right tabular-nums text-muted-strong">
                    {metres(o.totalMetres)}
                  </td>
                  <td className="mono px-4 py-3 text-right font-semibold tabular-nums text-fg">
                    {rupees(o.netPayable)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="mono inline-block rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                      style={{ color, borderColor: color }}
                    >
                      {PAYMENT_LABELS[o.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="mt-4 space-y-2 md:hidden">
        {orders.map((o) => {
          const color = statusColor(o.status);
          return (
            <li
              key={o.id}
              role="button"
              tabIndex={0}
              data-no-vitality
              onClick={() => onOpen(o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(o);
                }
              }}
              className="cursor-pointer rounded-xl border border-border bg-bg-elevated px-4 py-3 transition-colors hover:border-mint"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">
                    {o.partyName}
                  </p>
                  <p className="mono mt-0.5 text-[0.68rem] text-muted">
                    {o.itemName}
                    {o.dNo ? ` · ${o.dNo}` : ""}
                  </p>
                </div>
                <span
                  className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                  style={{ color, borderColor: color }}
                >
                  {PAYMENT_LABELS[o.status]}
                </span>
              </div>
              <div className="mono mt-2 flex items-baseline justify-between text-[0.72rem] tabular-nums text-muted">
                <span>
                  {shortDate(o.orderDate)} · {metres(o.totalMetres)}
                </span>
                <span className="font-semibold text-fg">
                  {rupees(o.netPayable)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
