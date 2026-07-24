"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { fetchSalesRows, type SalesRow } from "@/lib/supabase/orders";
import OrderDetailSheet from "@/components/business/orders/OrderDetailSheet";
import {
  PAYMENT_LABELS,
  ddmmyyyy,
  metres,
  rupees,
  shortDate,
  statusColor,
} from "@/components/business/orders/orderFormat";

type Range = "this_month" | "last_month" | "custom";

const RANGES: Array<{ key: Range; label: string }> = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom Date Range" },
];

const PAGE_SIZE = 20;

/** Local YYYY-MM-DD, matching how order_date is stored. */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive [start, end] YYYY-MM-DD bounds for a preset range. Custom bounds
 *  come from the two date inputs instead. */
function presetBounds(range: Range): { start: string; end: string } | null {
  const now = new Date();
  if (range === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: localISODate(start), end: localISODate(end) };
  }
  if (range === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: localISODate(start), end: localISODate(end) };
  }
  return null;
}

/** Whole-number totals for the sticky totals row. */
interface Totals {
  totalMetres: number;
  amount: number;
  netAmount: number;
}

function sumTotals(rows: SalesRow[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      totalMetres: acc.totalMetres + r.totalMetres,
      amount: acc.amount + r.totalAmount,
      netAmount: acc.netAmount + r.netPayable,
    }),
    { totalMetres: 0, amount: 0, netAmount: 0 }
  );
}

/** One CSV cell — quote and escape anything with a comma, quote, or newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADERS = [
  "Date",
  "Party",
  "Item",
  "D.No",
  "Top m",
  "Bot m",
  "Dup m",
  "Total m",
  "Amount",
  "GST",
  "Net Amount",
  "Days",
  "Due Date",
  "Status",
];

/** Builds the filtered register as a CSV string and triggers a browser
 *  download — no external library, just a Blob + object URL. */
function exportCsv(rows: SalesRow[]): void {
  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.orderDate,
        r.partyName,
        r.itemName,
        r.dNo,
        Math.round(r.topTotalMetres),
        Math.round(r.bottomTotalMetres),
        Math.round(r.dupattaTotalMetres),
        Math.round(r.totalMetres),
        Math.round(r.totalAmount),
        Math.round(r.gstAmount),
        Math.round(r.netPayable),
        r.paymentDays,
        r.dueDate,
        PAYMENT_LABELS[r.status],
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-register-${localISODate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * /business/sales — the Sales Register. A read-only table that builds itself
 * from every logged order: preset (this/last month) or custom date-range
 * filters, a CSV export of the filtered rows, a sticky-header table with a
 * sticky totals row, and 20-per-page pagination. Tapping a row opens the shared
 * Order Detail bottom sheet.
 */
export default function SalesScreen() {
  const [rows, setRows] = useState<SalesRow[] | null>(null);
  const [range, setRange] = useState<Range>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(0);
  const [openOrder, setOpenOrder] = useState<SalesRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSalesRows().then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The filtered set (all pages), used by both the table and the export.
  const filtered = useMemo(() => {
    if (rows === null) return null;
    if (range === "custom") {
      if (!customFrom && !customTo) return rows;
      return rows.filter((r) => {
        if (customFrom && r.orderDate < customFrom) return false;
        if (customTo && r.orderDate > customTo) return false;
        return true;
      });
    }
    const bounds = presetBounds(range);
    if (!bounds) return rows;
    return rows.filter(
      (r) => r.orderDate >= bounds.start && r.orderDate <= bounds.end
    );
  }, [rows, range, customFrom, customTo]);

  // Reset to the first page whenever the filter changes.
  useEffect(() => {
    setPage(0);
  }, [range, customFrom, customTo]);

  const totals = useMemo(
    () => (filtered ? sumTotals(filtered) : null),
    [filtered]
  );

  const pageCount = filtered ? Math.ceil(filtered.length / PAGE_SIZE) : 0;
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = filtered
    ? filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)
    : null;

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Sales Register
        </h2>
        <button
          type="button"
          className="btn-primary"
          disabled={!filtered || filtered.length === 0}
          onClick={() => filtered && exportCsv(filtered)}
        >
          <Download size={15} aria-hidden />
          Export
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

      {/* custom date range inputs */}
      {range === "custom" && (
        <div className="mono mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
          <label className="flex items-center gap-2">
            <span>From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              data-no-vitality
              className="rounded-md border px-2 py-1"
              style={{
                background: "var(--color-card)",
                borderColor: "var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            <span>To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              data-no-vitality
              className="rounded-md border px-2 py-1"
              style={{
                background: "var(--color-card)",
                borderColor: "var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
          </label>
        </div>
      )}

      {pageRows === null ? (
        <div
          className="mt-4 h-64 animate-pulse rounded-xl border border-border bg-bg-elevated"
          aria-hidden
        />
      ) : pageRows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {rows && rows.length === 0
            ? "No sales yet. Every order you log shows up here automatically."
            : "No sales in this date range."}
        </p>
      ) : (
        <>
          <RegisterTable
            rows={pageRows}
            totals={totals}
            onOpen={setOpenOrder}
          />
          <Pagination
            page={clampedPage}
            pageCount={pageCount}
            total={filtered?.length ?? 0}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </>
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
// Table — horizontal scroll on mobile, sticky dark header, sticky totals row
// ---------------------------------------------------------------------------

/** Header cells: left-aligned text columns, right-aligned amount/metre columns. */
const COLUMNS: Array<{ label: string; align: "left" | "right" }> = [
  { label: "Date", align: "left" },
  { label: "Party", align: "left" },
  { label: "Item", align: "left" },
  { label: "D.No", align: "left" },
  { label: "Top m", align: "right" },
  { label: "Bot m", align: "right" },
  { label: "Dup m", align: "right" },
  { label: "Total m", align: "right" },
  { label: "Amount", align: "right" },
  { label: "GST", align: "right" },
  { label: "Net Amount", align: "right" },
  { label: "Days", align: "right" },
  { label: "Due Date", align: "left" },
  { label: "Status", align: "right" },
];

function RegisterTable({
  rows,
  totals,
  onOpen,
}: {
  rows: SalesRow[];
  totals: Totals | null;
  onOpen: (r: SalesRow) => void;
}) {
  return (
    <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-border bg-bg-elevated">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr
            className="mono text-[0.6rem] uppercase tracking-[0.12em] text-muted"
            style={{ background: "var(--color-bg-elevated)" }}
          >
            {COLUMNS.map((c) => (
              <th
                key={c.label}
                className={`whitespace-nowrap border-b border-border px-3 py-3 font-normal ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => {
            const color = statusColor(r.status);
            // Alternating card / card-raised backgrounds.
            const bg =
              i % 2 === 0 ? "var(--color-card)" : "var(--color-card-elevated)";
            return (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                style={{ background: bg }}
              >
                <td className="mono whitespace-nowrap px-3 py-3 text-left tabular-nums text-muted-strong">
                  {shortDate(r.orderDate)}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-3 text-left font-medium text-fg">
                  {r.partyName}
                </td>
                <td className="max-w-[9rem] truncate px-3 py-3 text-left text-muted-strong">
                  {r.itemName}
                </td>
                <td className="mono whitespace-nowrap px-3 py-3 text-left text-muted">
                  {r.dNo || "—"}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                  {metres(r.topTotalMetres)}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                  {metres(r.bottomTotalMetres)}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                  {metres(r.dupattaTotalMetres)}
                </td>
                <td className="mono px-3 py-3 text-right font-semibold tabular-nums text-fg">
                  {metres(r.totalMetres)}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-fg">
                  {rupees(r.totalAmount)}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                  {rupees(r.gstAmount)}
                </td>
                <td className="mono px-3 py-3 text-right font-semibold tabular-nums text-fg">
                  {rupees(r.netPayable)}
                </td>
                <td className="mono px-3 py-3 text-right tabular-nums text-muted-strong">
                  {r.paymentDays}
                </td>
                <td className="mono whitespace-nowrap px-3 py-3 text-left tabular-nums text-muted-strong">
                  {ddmmyyyy(r.dueDate)}
                </td>
                <td className="px-3 py-3 text-right">
                  <span
                    className="mono inline-block rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                    style={{ color, borderColor: color }}
                  >
                    {PAYMENT_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>

        {totals && (
          <tfoot className="sticky bottom-0 z-10">
            <tr
              className="mono text-[0.78rem] tabular-nums"
              style={{
                background: "var(--color-bg-elevated)",
                color: "var(--accent)",
              }}
            >
              <td
                className="whitespace-nowrap border-t border-border-strong px-3 py-3 text-left text-[0.6rem] uppercase tracking-[0.12em]"
                colSpan={7}
                style={{ background: "var(--color-bg-elevated)" }}
              >
                Totals · {rows.length} shown
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {metres(totals.totalMetres)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {rupees(totals.amount)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3"
                style={{ background: "var(--color-bg-elevated)" }}
              />
              <td
                className="border-t border-border-strong px-3 py-3 text-right font-bold"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {rupees(totals.netAmount)}
              </td>
              <td
                className="border-t border-border-strong px-3 py-3"
                colSpan={3}
                style={{ background: "var(--color-bg-elevated)" }}
              />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-no-vitality
          onClick={onPrev}
          disabled={page === 0}
          className="rounded-full border border-border px-3.5 py-1.5 text-[0.78rem] font-medium text-muted-strong transition-colors hover:border-mint disabled:opacity-40 disabled:hover:border-border"
        >
          Prev
        </button>
        <button
          type="button"
          data-no-vitality
          onClick={onNext}
          disabled={page >= pageCount - 1}
          className="rounded-full border border-border px-3.5 py-1.5 text-[0.78rem] font-medium text-muted-strong transition-colors hover:border-mint disabled:opacity-40 disabled:hover:border-border"
        >
          Next
        </button>
      </div>
    </div>
  );
}
