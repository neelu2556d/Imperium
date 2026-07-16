"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BottomSheet from "@/components/vitals/BottomSheet";
import { StatusBadge } from "@/components/business/LotCard";
import {
  fetchLotDetail,
  type LotDetail,
  type LotOrder,
} from "@/lib/supabase/lots";

const rupees = (n: number): string =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;
const metres = (n: number): string =>
  `${Math.round(n).toLocaleString("en-IN")}m`;

function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const PAYMENT_LABELS: Record<LotOrder["paymentStatus"], string> = {
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partial",
};

function paymentColor(status: LotOrder["paymentStatus"]): string {
  switch (status) {
    case "paid":
      return "var(--accent)";
    case "overdue":
      return "#f87171";
    case "partial":
      return "var(--color-amber)";
    default:
      return "var(--color-muted-strong)";
  }
}

/** Remaining-stock colour: mint above threshold, amber when low, red when
 *  nearly gone (under a fifth of the threshold). */
function remainingColor(remaining: number, threshold: number): string {
  if (remaining <= threshold * 0.2) return "var(--color-danger)";
  if (remaining < threshold) return "var(--color-amber)";
  return "var(--accent)";
}

/**
 * /business/lots/[lot_id] — one lot's full picture: design photo, status,
 * the per-component stock table, every order logged against it (tap → order
 * bottom sheet), and profitability when cost prices were entered.
 */
export default function LotDetailScreen({ lotId }: { lotId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<LotDetail | null | undefined>(undefined);
  const [openOrder, setOpenOrder] = useState<LotOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLotDetail(lotId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [lotId]);

  if (detail === undefined) {
    return (
      <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12" aria-hidden>
        <div className="h-8 w-56 animate-pulse rounded-lg border border-border bg-bg-elevated" />
        <div className="mt-4 h-56 animate-pulse rounded-lg border border-border bg-bg-elevated" />
        <div className="mt-4 h-40 animate-pulse rounded-xl border border-border bg-bg-elevated" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
        <BackHeading onBack={() => router.push("/business/lots")} title="Lot not found" />
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          This lot doesn&apos;t exist or was removed.
        </p>
      </div>
    );
  }

  const { stock, costs, orders, profitability } = detail;

  const rows = [
    { name: "Top", comp: stock.top },
    { name: "Bottom", comp: stock.bottom },
    { name: "Dupatta", comp: stock.dupatta },
  ];

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <BackHeading
        onBack={() => router.push("/business/lots")}
        title={stock.itemName}
        dNo={stock.dNo}
      />

      {/* design photo */}
      {stock.designPhotoUrl ? (
        <div
          className="mt-4 w-full overflow-hidden rounded-lg border border-border"
          style={{ background: "var(--color-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stock.designPhotoUrl}
            alt={`Design ${stock.dNo || stock.itemName}`}
            className="mx-auto max-h-[300px] w-full object-contain"
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <StatusBadge status={stock.status} />
        <span className="mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          Arrived {shortDate(stock.dateArrived)} · {stock.daysSince} day
          {stock.daysSince === 1 ? "" : "s"} ago
        </span>
      </div>

      {/* stock table */}
      <section className="mt-6 rounded-2xl border border-border bg-bg-elevated px-4 py-4">
        <h2 className="serif-italic text-xl" data-no-vitality>
          Stock
        </h2>
        <table className="mono mt-3 w-full text-[0.78rem] tabular-nums">
          <thead>
            <tr className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
              <th className="pb-2 text-left font-normal">Component</th>
              <th className="pb-2 text-right font-normal">Opening</th>
              <th className="pb-2 text-right font-normal">Sold</th>
              <th className="pb-2 text-right font-normal">Remaining</th>
              <th className="pb-2 text-right font-normal">% Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, comp }) => {
              const pctLeft =
                comp.opening > 0 ? (comp.remaining / comp.opening) * 100 : 0;
              return (
                <tr key={name} className="border-t border-border">
                  <td className="py-2.5 text-left text-muted-strong">{name}</td>
                  <td className="py-2.5 text-right">{metres(comp.opening)}</td>
                  <td className="py-2.5 text-right">{metres(comp.sold)}</td>
                  <td
                    className="py-2.5 text-right font-semibold"
                    style={{
                      color: remainingColor(comp.remaining, stock.threshold),
                    }}
                  >
                    {metres(comp.remaining)}
                  </td>
                  <td className="py-2.5 text-right text-muted-strong">
                    {Math.max(0, Math.round(pctLeft))}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* orders against this lot */}
      <section className="mt-6">
        <div className="flex items-baseline gap-2">
          <h2 className="serif-italic text-xl" data-no-vitality>
            Orders
          </h2>
          <span className="mono text-[0.7rem] text-muted">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            No orders against this lot yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-elevated">
            <table className="mono w-full text-[0.75rem] tabular-nums">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-3 py-2.5 text-left font-normal">Date</th>
                  <th className="px-3 py-2.5 text-left font-normal">Party</th>
                  <th className="px-3 py-2.5 text-right font-normal">Metres</th>
                  <th className="px-3 py-2.5 text-right font-normal">Amount</th>
                  <th className="px-3 py-2.5 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-white/[0.03]"
                    onClick={() => setOpenOrder(o)}
                  >
                    <td className="px-3 py-2.5 text-left text-muted-strong">
                      {shortDate(o.orderDate)}
                    </td>
                    <td className="max-w-[7rem] truncate px-3 py-2.5 text-left font-sans text-fg">
                      {o.partyName}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {metres(o.totalMetres)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {rupees(o.netPayable)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right text-[0.65rem] uppercase tracking-[0.08em]"
                      style={{ color: paymentColor(o.paymentStatus) }}
                    >
                      {PAYMENT_LABELS[o.paymentStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* profitability — only when cost prices were entered */}
      {profitability ? (
        <section className="card-raised mt-6 px-5 py-5">
          <h2 className="serif-italic text-xl" data-no-vitality>
            Profitability
          </h2>
          <dl className="mono mt-3 space-y-2.5 text-[0.8rem] tabular-nums">
            <ProfitRow label="Total cost" value={rupees(profitability.totalCost)} />
            <ProfitRow label="Revenue so far" value={rupees(profitability.revenue)} />
            <ProfitRow
              label="Gross profit"
              value={rupees(profitability.grossProfit)}
              color={
                profitability.grossProfit >= 0 ? "var(--accent)" : "#f87171"
              }
            />
            <ProfitRow
              label="Margin"
              value={
                profitability.marginPct == null
                  ? "—"
                  : `${profitability.marginPct.toFixed(1)}%`
              }
              color={
                profitability.marginPct != null && profitability.marginPct < 0
                  ? "#f87171"
                  : undefined
              }
            />
            <ProfitRow
              label="Unsold stock value"
              value={rupees(profitability.unsoldStockValue)}
            />
          </dl>
          {(costs.top == null || costs.bottom == null || costs.dupatta == null) && (
            <p className="mt-3 text-[0.72rem] text-muted">
              Some components have no cost price — figures cover priced
              components only.
            </p>
          )}
        </section>
      ) : null}

      {openOrder && (
        <OrderDetailSheet order={openOrder} onClose={() => setOpenOrder(null)} />
      )}
    </div>
  );
}

function BackHeading({
  onBack,
  title,
  dNo,
}: {
  onBack: () => void;
  title: string;
  dNo?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-no-vitality
        aria-label="Back to lots"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-mint hover:text-fg"
      >
        <ArrowLeft size={17} />
      </button>
      <h2 className="serif-italic min-w-0 truncate text-2xl md:text-3xl" data-no-vitality>
        {title}
        {dNo ? (
          <span className="mono ml-2 align-middle text-[0.75rem] not-italic text-muted">
            {dNo}
          </span>
        ) : null}
      </h2>
    </div>
  );
}

function ProfitRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="font-semibold" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}

/** Compact order summary in the shared bottom sheet, opened from a table row. */
function OrderDetailSheet({
  order,
  onClose,
}: {
  order: LotOrder;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Order" onClose={onClose}>
      <div className="mt-3">
        <p className="text-lg font-medium text-fg">{order.partyName}</p>
        <p className="mono mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          {shortDate(order.orderDate)}
        </p>
        <dl className="mono mt-4 space-y-2.5 text-[0.8rem] tabular-nums">
          <ProfitRow label="Total metres" value={metres(order.totalMetres)} />
          <ProfitRow label="Net payable" value={rupees(order.netPayable)} />
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-muted">
              Payment
            </dt>
            <dd
              className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]"
              style={{ color: paymentColor(order.paymentStatus) }}
            >
              {PAYMENT_LABELS[order.paymentStatus]}
            </dd>
          </div>
        </dl>
      </div>
    </BottomSheet>
  );
}
