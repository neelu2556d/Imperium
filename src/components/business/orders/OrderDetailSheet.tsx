"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/vitals/BottomSheet";
import {
  fetchOrderDetail,
  type OrderDetail,
  type OrderRow,
} from "@/lib/supabase/orders";
import {
  PAYMENT_LABELS,
  ddmmyyyy,
  metres,
  rupees,
  shortDate,
  statusColor,
} from "./orderFormat";

/**
 * The order detail bottom sheet, opened by tapping a row on the Orders list.
 * Loads the full pricing breakdown for the order and lays it out invoice-style
 * (component lines → subtotal → discount → GST → total → CD → net payable).
 */
export default function OrderDetailSheet({
  order,
  onClose,
}: {
  order: OrderRow;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    fetchOrderDetail(order.id).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const color = statusColor(order.status);

  return (
    <BottomSheet title="Order" onClose={onClose}>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-medium text-fg">{order.partyName}</p>
          <p className="mono mt-1 text-[0.7rem] text-muted">
            {order.itemName}
            {order.dNo ? ` · ${order.dNo}` : ""}
          </p>
          <p className="mono mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-muted">
            {shortDate(order.orderDate)}
          </p>
        </div>
        <span
          className="mono shrink-0 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.12em]"
          style={{ color, borderColor: color }}
        >
          {PAYMENT_LABELS[order.status]}
        </span>
      </div>

      {detail === undefined ? (
        <div
          className="mt-5 h-64 animate-pulse rounded-xl border border-border"
          aria-hidden
        />
      ) : detail === null ? (
        <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Couldn&apos;t load this order.
        </p>
      ) : (
        <Breakdown detail={detail} />
      )}
    </BottomSheet>
  );
}

function Breakdown({ detail: d }: { detail: OrderDetail }) {
  const components: Array<[string, number, number, number]> = [
    ["Top", d.topTotalMetres, d.topRate, d.topAmount],
    ["Bottom", d.bottomTotalMetres, d.bottomRate, d.bottomAmount],
    ["Dupatta", d.dupattaTotalMetres, d.dupattaRate, d.dupattaAmount],
  ];

  return (
    <div
      className="mono mt-5 rounded-xl border px-4 py-4 text-[0.78rem] tabular-nums"
      style={{
        borderColor: "var(--color-border-strong)",
        background: "var(--color-card)",
      }}
    >
      <p className="mb-3 text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {d.numColours} colour{d.numColours === 1 ? "" : "s"} · {metres(d.totalMetres)}
      </p>

      {components.map(([name, m, rate, amount]) => (
        <Line
          key={name}
          label={`${name}`}
          detail={`${metres(m)} × ₹${rate.toFixed(2)}`}
          value={rupees(amount)}
        />
      ))}

      <Divider />
      <Line label="Subtotal" value={rupees(d.subtotal)} />
      {d.discountPercent > 0 && (
        <Line
          label={`Discount ${d.discountPercent}%`}
          value={`-${rupees(d.discountAmount)}`}
        />
      )}
      <Line label="After discount" value={rupees(d.afterDiscount)} />
      <Line
        label={d.gstApplicable ? "GST 5%" : "GST"}
        value={d.gstApplicable ? `+${rupees(d.gstAmount)}` : rupees(0)}
      />
      <Divider />
      <div className="flex items-baseline justify-between gap-3 py-1">
        <span className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-strong">
          Total
        </span>
        <span
          className="text-base font-semibold"
          style={{ color: "var(--accent)" }}
        >
          {rupees(d.totalAmount)}
        </span>
      </div>
      {d.cdPercent > 0 && (
        <Line
          label={`CD ${d.cdPercent}% (within ${d.paymentDays}d)`}
          value={`-${rupees(d.cdAmount)}`}
        />
      )}
      <Line label="Net payable" value={rupees(d.netPayable)} strong />
      <Divider />
      <Line label="Due date" value={ddmmyyyy(d.dueDate)} />
      {d.amountReceived > 0 && (
        <Line label="Received" value={rupees(d.amountReceived)} />
      )}
    </div>
  );
}

function Line({
  label,
  detail,
  value,
  strong,
}: {
  label: string;
  detail?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 truncate text-muted-strong">
        {label}
        {detail ? (
          <span className="ml-1.5 text-[0.68rem] text-muted">{detail}</span>
        ) : null}
      </span>
      <span className={strong ? "font-semibold text-fg" : "text-fg"}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-2 border-t border-dashed"
      style={{ borderColor: "var(--color-border)" }}
      aria-hidden
    />
  );
}
