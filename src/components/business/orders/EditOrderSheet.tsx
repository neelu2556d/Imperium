"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import BottomSheet from "@/components/vitals/BottomSheet";
import {
  fetchAllLots,
  fetchItemMaster,
  recomputeLotStatus,
  type ItemMasterEntry,
} from "@/lib/supabase/lots";
import type { LotStock } from "@/lib/supabase/business";
import {
  computeDueDate,
  computeTotals,
  createParty,
  fetchActiveLotOptions,
  fetchOrderDetail,
  fetchParties,
  fetchRateCard,
  updateOrder,
  upsertRateCard,
  type ActiveLotOption,
  type OrderDetail,
  type OrderRow,
  type PartyEntry,
  type PaymentStatus,
} from "@/lib/supabase/orders";
import { ddmmyyyy, metres, rupees, statusColor } from "./orderFormat";

const PAYMENT_OPTIONS: Array<{ key: PaymentStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "partial", label: "Partial" },
  { key: "overdue", label: "Overdue" },
];

const LOT_STATUS_LABELS: Record<string, string> = {
  arrived: "Arrived",
  active: "Active",
  low_stock: "Low stock",
  cleared: "Cleared",
  dead_stock: "Dead stock",
};

const toNum = (v: string | number | null): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const RATE_EPSILON = 0.005;
const ratesDiffer = (a: number | null, b: number): boolean =>
  Math.abs(toNum(a) - b) > RATE_EPSILON;

const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
} as const;

const inputFull = {
  ...inputStyle,
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
      {children}
    </p>
  );
}

/**
 * Bottom sheet for editing every editable field of an existing order: date,
 * party (searchable, with inline add), item + lot (with the order's current lot
 * merged in so it can stay on a cleared/dead-stock lot), quantities, rates,
 * terms, payment, and a live invoice preview. On save calls `updateOrder` with
 * the full set, re-balances the old lot's status when the order is moved, and
 * reconciles the saved rate card for the (new) party + item.
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

  // Lookup data loaded in parallel with the order detail.
  const [detail, setDetail] = useState<OrderDetail | null | undefined>(
    undefined
  );
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [activeLots, setActiveLots] = useState<ActiveLotOption[]>([]);
  const [allLots, setAllLots] = useState<LotStock[]>([]);

  // Form fields
  const [orderDate, setOrderDate] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [addingName, setAddingName] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [savingParty, setSavingParty] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [lotId, setLotId] = useState<string | null>(null);
  const [dNo, setDNo] = useState("");
  const [topPer, setTopPer] = useState("");
  const [bottomPer, setBottomPer] = useState("");
  const [dupattaPer, setDupattaPer] = useState("");
  const [numColours, setNumColours] = useState(1);
  const [topRate, setTopRate] = useState("");
  const [bottomRate, setBottomRate] = useState("");
  const [dupattaRate, setDupattaRate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState(false);
  const [cdPercent, setCdPercent] = useState("0");
  const [paymentDays, setPaymentDays] = useState("45");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [amountReceived, setAmountReceived] = useState("");

  // Which fields the user actually changed this session (drives the payment
  // status rule + whether party terms get re-applied).
  const [statusTouched, setStatusTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [cdTouched, setCdTouched] = useState(false);
  const [gstTouched, setGstTouched] = useState(false);
  const [paymentDaysTouched, setPaymentDaysTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCardPrompt, setRateCardPrompt] = useState<{
    toast: string;
    partyName: string;
    itemName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOrderDetail(order.id),
      fetchParties(),
      fetchItemMaster(),
      fetchActiveLotOptions(),
      fetchAllLots(),
    ]).then(([d, p, i, a, l]) => {
      if (cancelled) return;
      // Pre-fill every field from the detail in the same async tick it lands —
      // the promise callback is the one place the form fields can be seeded
      // without cascading renders (the set-state-in-effect rule).
      if (d) {
        setOrderDate(d.orderDate);
        setPartyQuery(d.partyName);
        setPartyId(d.partyId);
        setItemQuery(d.itemName);
        setItemId(d.itemId);
        setLotId(d.lotId);
        setDNo(d.dNo);
        setTopPer(String(d.topPerColour));
        setBottomPer(String(d.bottomPerColour));
        setDupattaPer(String(d.dupattaPerColour));
        setNumColours(d.numColours || 1);
        setTopRate(String(d.topRate));
        setBottomRate(String(d.bottomRate));
        setDupattaRate(String(d.dupattaRate));
        setDiscount(String(d.discountPercent));
        setGst(d.gstApplicable);
        setCdPercent(String(d.cdPercent));
        setPaymentDays(String(d.paymentDays || 45));
        setPaymentStatus(d.status);
        setAmountReceived(
          d.amountReceived > 0 ? String(d.amountReceived) : ""
        );
      }
      setDetail(d);
      setParties(p);
      setItems(i);
      setActiveLots(a);
      setAllLots(l);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Lot options = active/arrived lots + the order's current lot (which may be
  // cleared/dead-stock and therefore filtered out of fetchActiveLotOptions).
  const lotOptions = useMemo(() => {
    const merged: ActiveLotOption[] = [...activeLots];
    if (detail?.lotId && !merged.some((l) => l.lotId === detail.lotId)) {
      const lot = allLots.find((l) => l.lotId === detail.lotId);
      if (lot) {
        merged.push({
          lotId: lot.lotId,
          itemId: detail.itemId,
          itemName: lot.itemName,
          dNo: lot.dNo,
          designPhotoUrl: lot.designPhotoUrl,
          status: lot.status,
          topRemaining: lot.top.remaining,
          bottomRemaining: lot.bottom.remaining,
          dupattaRemaining: lot.dupatta.remaining,
        });
      }
    }
    return merged;
  }, [activeLots, allLots, detail]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, itemQuery]);

  const exactItemMatch = items.find(
    (i) => i.itemName.toLowerCase() === itemQuery.trim().toLowerCase()
  );

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) => p.partyName.toLowerCase().includes(q));
  }, [parties, partyQuery]);

  const exactPartyMatch = parties.some(
    (p) => p.partyName.toLowerCase() === partyQuery.trim().toLowerCase()
  );

  const lotsForItem = useMemo(() => {
    if (!itemId && !itemQuery.trim()) return [];
    const name = itemQuery.trim().toLowerCase();
    return lotOptions.filter((l) =>
      itemId ? l.itemId === itemId : l.itemName.toLowerCase() === name
    );
  }, [lotOptions, itemId, itemQuery]);

  const selectedLot = useMemo(
    () => lotOptions.find((l) => l.lotId === lotId) ?? null,
    [lotOptions, lotId]
  );

  const applyParty = (p: PartyEntry) => {
    setPartyQuery(p.partyName);
    setPartyId(p.id);
    if (!cdTouched) setCdPercent(String(p.cdPercent));
    if (!gstTouched) setGst(p.gstPreference === "gst");
    if (!paymentDaysTouched) setPaymentDays(String(p.defaultPaymentDays || 45));
  };

  const pickItem = (id: string | null, name: string) => {
    setItemId(id);
    setItemQuery(name);
    setLotId(null);
    setItemPickerOpen(false);
  };

  const pickLot = (id: string) => {
    setLotId(id);
    const lot = lotOptions.find((l) => l.lotId === id);
    if (lot) {
      if (lot.itemName) pickItem(lot.itemId, lot.itemName);
      if (lot.dNo) setDNo(lot.dNo);
    }
  };

  const saveParty = async () => {
    if (!addingName || savingParty) return;
    setSavingParty(true);
    setError(null);
    try {
      const created = await createParty({
        partyName: addingName,
        area: area.trim() || null,
        city: city.trim() || null,
      });
      setParties((prev) =>
        [...prev, created].sort((a, b) => a.partyName.localeCompare(b.partyName))
      );
      setAddingName(null);
      setArea("");
      setCity("");
      applyParty(created);
    } catch {
      setError("Couldn't save the party. Try again.");
    } finally {
      setSavingParty(false);
    }
  };

  const totals = useMemo(
    () =>
      computeTotals({
        topPerColour: toNum(topPer),
        bottomPerColour: toNum(bottomPer),
        dupattaPerColour: toNum(dupattaPer),
        numColours,
        topRate: toNum(topRate),
        bottomRate: toNum(bottomRate),
        dupattaRate: toNum(dupattaRate),
        discountPercent: toNum(discount),
        gstApplicable: gst,
        cdPercent: toNum(cdPercent),
      }),
    [
      topPer,
      bottomPer,
      dupattaPer,
      numColours,
      topRate,
      bottomRate,
      dupattaRate,
      discount,
      gst,
      cdPercent,
    ]
  );

  const dueDate = computeDueDate(orderDate || "2000-01-01", toNum(paymentDays));

  const canSave =
    detail !== null &&
    detail !== undefined &&
    orderDate.trim() !== "" &&
    partyQuery.trim() !== "" &&
    itemQuery.trim() !== "" &&
    !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const oldLotId = detail?.lotId ?? null;

      await updateOrder(order.id, {
        orderDate,
        partyId: partyId ?? undefined,
        partyName: partyQuery.trim(),
        lotId: lotId ?? undefined,
        itemId,
        itemName: itemQuery.trim(),
        dNo,
        topPerColour: toNum(topPer),
        bottomPerColour: toNum(bottomPer),
        dupattaPerColour: toNum(dupattaPer),
        numColours,
        topRate: toNum(topRate),
        bottomRate: toNum(bottomRate),
        dupattaRate: toNum(dupattaRate),
        discountPercent: toNum(discount),
        gstApplicable: gst,
        cdPercent: toNum(cdPercent),
        paymentDays: toNum(paymentDays),
        ...(statusTouched ? { paymentStatus } : {}),
        ...(amountTouched
          ? { amountReceived: amountReceived.trim() ? toNum(amountReceived) : 0 }
          : {}),
      });

      // Moving the order off a lot: the DB trigger rebalances the new lot, but
      // the old one needs a manual recompute (best-effort).
      if (oldLotId && lotId && oldLotId !== lotId) {
        await recomputeLotStatus(oldLotId);
      }

      const toast = `${partyQuery.trim()} — order updated.`;

      // Rate-card reconcile for the (new) party + item.
      if (itemId && partyId) {
        const card = await fetchRateCard(partyId, itemId);
        if (!card) {
          await upsertRateCard(partyId, itemId, {
            topRate: toNum(topRate),
            bottomRate: toNum(bottomRate),
            dupattaRate: toNum(dupattaRate),
          });
          pushToast(toast);
          onSaved();
          return;
        }
        if (
          ratesDiffer(card.topRate, toNum(topRate)) ||
          ratesDiffer(card.bottomRate, toNum(bottomRate)) ||
          ratesDiffer(card.dupattaRate, toNum(dupattaRate))
        ) {
          setSaving(false);
          setRateCardPrompt({
            toast,
            partyName: partyQuery.trim(),
            itemName: itemQuery.trim(),
          });
          return;
        }
      }

      pushToast(toast);
      onSaved();
    } catch {
      setError("Couldn't save changes. Check your connection and try again.");
      setSaving(false);
    }
  };

  const finishAfterPrompt = () => {
    if (rateCardPrompt) pushToast(rateCardPrompt.toast);
    onSaved();
  };

  const onUpdateRateCard = async () => {
    if (itemId && partyId) {
      try {
        await upsertRateCard(partyId, itemId, {
          topRate: toNum(topRate),
          bottomRate: toNum(bottomRate),
          dupattaRate: toNum(dupattaRate),
        });
      } catch {
        /* non-fatal — the order is already saved */
      }
    }
    finishAfterPrompt();
  };

  const colourChips = (set: (v: PaymentStatus) => void, value: PaymentStatus) => {
    return (
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_OPTIONS.map(({ key, label }) => {
          const active = value === key;
          const color = statusColor(key);
          return (
            <button
              key={key}
              type="button"
              data-no-vitality
              aria-pressed={active}
              onClick={() => {
                set(key);
                setStatusTouched(true);
              }}
              className="rounded-full border px-3 py-2 text-[0.78rem] font-medium transition-colors"
              style={
                active
                  ? {
                      background: color,
                      color: key === "overdue" ? "#fff" : "var(--accent-ink)",
                      borderColor: color,
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
    );
  };

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
        className={`relative flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
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
            {order.dNo ? ` · ${order.dNo}` : ""} · {rupees(order.netPayable)}
          </p>
        </div>

        {detail === undefined ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4" aria-hidden>
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-border bg-bg-elevated"
                />
              ))}
            </div>
          </div>
        ) : detail === null ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
            <p className="text-sm text-muted">
              Couldn&rsquo;t load this order&rsquo;s details.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
            <div className="flex flex-col gap-6">
              {/* 1 · Date */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>1 · Date</SectionTitle>
                <Field label="Order date">
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mono w-full"
                    data-no-vitality
                    style={inputFull}
                  />
                </Field>
              </section>

              {/* 2 · Party */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>2 · Party</SectionTitle>
                <Field label="Party">
                  <div className="relative">
                    <input
                      type="text"
                      value={partyQuery}
                      placeholder="Search or type a new party"
                      onChange={(e) => {
                        setPartyQuery(e.target.value);
                        setPartyId(null);
                        setAddingName(null);
                        setPartyPickerOpen(true);
                      }}
                      onFocus={() => setPartyPickerOpen(true)}
                      onBlur={() => setTimeout(() => setPartyPickerOpen(false), 150)}
                      className="w-full"
                      data-no-vitality
                      style={inputFull}
                    />
                    {partyPickerOpen &&
                      partyQuery.trim() &&
                      (filteredParties.length > 0 || !exactPartyMatch) && (
                        <ul
                          className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border shadow-lg"
                          style={{
                            borderColor: "var(--color-border-strong)",
                            background: "var(--color-bg-elevated)",
                          }}
                        >
                          {filteredParties.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                data-no-vitality
                                className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm text-fg hover:bg-white/[0.05]"
                                onMouseDown={() => {
                                  applyParty(p);
                                  setPartyPickerOpen(false);
                                }}
                              >
                                {p.partyName}
                                {p.city ? (
                                  <span className="ml-1.5 text-[0.72rem] text-muted">
                                    {p.city}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          ))}
                          {!exactPartyMatch && (
                            <li>
                              <button
                                type="button"
                                data-no-vitality
                                className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                                style={{ color: "var(--accent)" }}
                                onMouseDown={() => {
                                  setAddingName(partyQuery.trim());
                                  setPartyPickerOpen(false);
                                }}
                              >
                                Add &ldquo;{partyQuery.trim()}&rdquo; as new party
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                  </div>
                </Field>

                {addingName && (
                  <div
                    className="flex flex-col gap-3 rounded-xl border px-4 py-4"
                    style={{
                      borderColor: "var(--color-border-strong)",
                      background: "var(--color-card)",
                    }}
                  >
                    <p className="text-sm font-medium text-fg">
                      New party: {addingName}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Area">
                        <input
                          type="text"
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className="w-full"
                          data-no-vitality
                          style={inputFull}
                        />
                      </Field>
                      <Field label="City">
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full"
                          data-no-vitality
                          style={inputFull}
                        />
                      </Field>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        data-no-vitality
                        onClick={() => setAddingName(null)}
                        className="rounded-full border bg-transparent px-4 py-2 text-sm font-medium"
                        style={{
                          borderColor: "var(--color-border-strong)",
                          color: "var(--color-muted-strong)",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        disabled={savingParty}
                        onClick={saveParty}
                      >
                        {savingParty ? "Saving…" : "Save party"}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* 3 · Item & lot */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>3 · Item &amp; lot / D.No.</SectionTitle>
                <Field label="Item">
                  <div className="relative">
                    <input
                      type="text"
                      value={itemQuery}
                      placeholder="Search or type"
                      onChange={(e) => {
                        setItemQuery(e.target.value);
                        setItemId(null);
                        setLotId(null);
                        setItemPickerOpen(true);
                      }}
                      onFocus={() => setItemPickerOpen(true)}
                      onBlur={() => setTimeout(() => setItemPickerOpen(false), 150)}
                      className="w-full"
                      data-no-vitality
                      style={inputFull}
                    />
                    {itemPickerOpen &&
                      itemQuery.trim() &&
                      (filteredItems.length > 0 || !exactItemMatch) && (
                        <ul
                          className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border shadow-lg"
                          style={{
                            borderColor: "var(--color-border-strong)",
                            background: "var(--color-bg-elevated)",
                          }}
                        >
                          {filteredItems.map((i) => (
                            <li key={i.id}>
                              <button
                                type="button"
                                data-no-vitality
                                className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm text-fg hover:bg-white/[0.05]"
                                onMouseDown={() => pickItem(i.id, i.itemName)}
                              >
                                {i.itemName}
                              </button>
                            </li>
                          ))}
                          {!exactItemMatch && (
                            <li>
                              <button
                                type="button"
                                data-no-vitality
                                className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                                style={{ color: "var(--accent)" }}
                                onMouseDown={() => pickItem(null, itemQuery.trim())}
                              >
                                Use &ldquo;{itemQuery.trim()}&rdquo;
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                  </div>
                </Field>

                <Field label="Lot / D.No.">
                  <select
                    value={lotId ?? ""}
                    disabled={!itemId && !itemQuery.trim()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) pickLot(v);
                      else setLotId(null);
                    }}
                    className="mono w-full"
                    data-no-vitality
                    style={inputFull}
                  >
                    <option value="">
                      {itemId || itemQuery.trim()
                        ? "No lot (pick one to move)"
                        : "Pick an item first"}
                    </option>
                    {lotsForItem.map((l) => (
                      <option key={l.lotId} value={l.lotId}>
                        {`${l.dNo || "No D.No."} — T: ${metres(
                          l.topRemaining
                        )} · B: ${metres(l.bottomRemaining)} · D: ${metres(
                          l.dupattaRemaining
                        )}${l.status !== "active" ? ` · ${LOT_STATUS_LABELS[l.status]}` : ""}`}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedLot && (
                  <div
                    className="flex items-center gap-3 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: "var(--color-border)",
                      background: "var(--color-card)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                        D.No.
                      </p>
                      <p className="mono text-base font-semibold text-fg">
                        {selectedLot.dNo || "—"}
                      </p>
                    </div>
                    <p className="mono text-[0.7rem] text-muted">
                      T {metres(selectedLot.topRemaining)} · B{" "}
                      {metres(selectedLot.bottomRemaining)} · D{" "}
                      {metres(selectedLot.dupattaRemaining)}
                    </p>
                  </div>
                )}

                <Field label="D.No. (printed)">
                  <input
                    type="text"
                    value={dNo}
                    placeholder="e.g. TT-247"
                    onChange={(e) => setDNo(e.target.value)}
                    className="mono w-full"
                    data-no-vitality
                    style={inputFull}
                  />
                </Field>
              </section>

              {/* 4 · Quantity */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>4 · Quantity</SectionTitle>
                {(
                  [
                    ["Top (m)", topPer, setTopPer],
                    ["Bottom (m)", bottomPer, setBottomPer],
                    ["Dupatta (m)", dupattaPer, setDupattaPer],
                  ] as Array<[string, string, (v: string) => void]>
                ).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      placeholder="0"
                      onChange={(e) => set(e.target.value)}
                      className="mono w-full tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                ))}

                <div className="flex items-center justify-between gap-4">
                  <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                    Number of colours:
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      data-no-vitality
                      aria-label="Fewer colours"
                      disabled={numColours <= 1}
                      onClick={() => setNumColours(Math.max(1, numColours - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-full border bg-transparent text-fg disabled:opacity-40"
                      style={{ borderColor: "var(--color-border-strong)" }}
                    >
                      <Minus size={15} aria-hidden />
                    </button>
                    <span className="mono w-9 text-center text-xl font-semibold tabular-nums text-fg">
                      {numColours}
                    </span>
                    <button
                      type="button"
                      data-no-vitality
                      aria-label="More colours"
                      onClick={() => setNumColours(numColours + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border bg-transparent text-fg"
                      style={{ borderColor: "var(--color-border-strong)" }}
                    >
                      <Plus size={15} aria-hidden />
                    </button>
                  </div>
                </div>
                <p className="mono text-[0.72rem] tabular-nums text-muted">
                  Total: {metres(totals.totalMetres)}
                </p>
              </section>

              {/* 5 · Rates */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>5 · Rates (₹/m)</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["Top", topRate, setTopRate],
                      ["Bottom", bottomRate, setBottomRate],
                      ["Dupatta", dupattaRate, setDupattaRate],
                    ] as Array<[string, string, (v: string) => void]>
                  ).map(([label, value, set]) => (
                    <Field key={label} label={label}>
                      <div className="relative">
                        <span className="mono pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                          ₹
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={value}
                          placeholder="0"
                          onChange={(e) => set(e.target.value)}
                          className="mono w-full pl-7 text-right tabular-nums"
                          data-no-vitality
                          style={inputFull}
                        />
                      </div>
                    </Field>
                  ))}
                </div>
              </section>

              {/* 6 · Terms */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>6 · Terms</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Discount %">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="mono w-full tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                  <Field label="CD %">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      value={cdPercent}
                      onChange={(e) => {
                        setCdPercent(e.target.value);
                        setCdTouched(true);
                      }}
                      className="mono w-full tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                  <Field label="Payment days">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={paymentDays}
                      onChange={(e) => {
                        setPaymentDays(e.target.value);
                        setPaymentDaysTouched(true);
                      }}
                      className="mono w-full tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                    GST
                  </span>
                  <div
                    data-no-vitality
                    role="group"
                    className="inline-flex items-center gap-0.5 rounded-full p-0.5"
                    style={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {(
                      [
                        [false, "Non-GST"],
                        [true, "GST (5%)"],
                      ] as Array<[boolean, string]>
                    ).map(([value, label]) => {
                      const active = gst === value;
                      return (
                        <button
                          key={label}
                          type="button"
                          data-no-vitality
                          aria-pressed={active}
                          onClick={() => {
                            setGst(value);
                            setGstTouched(true);
                          }}
                          className="rounded-full border-0 px-3 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            background: active ? "var(--accent)" : "transparent",
                            color: active
                              ? "var(--accent-ink)"
                              : "var(--color-muted)",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 7 · Payment */}
              <section className="flex flex-col gap-4" data-no-vitality>
                <SectionTitle>7 · Payment</SectionTitle>
                <Field label="Payment status">
                  {colourChips(setPaymentStatus, paymentStatus)}
                </Field>
                <Field label="Amount received (₹)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amountReceived}
                    placeholder="0"
                    onChange={(e) => {
                      setAmountReceived(e.target.value);
                      setAmountTouched(true);
                    }}
                    className="mono w-full tabular-nums"
                    data-no-vitality
                    style={inputFull}
                  />
                  <p className="mt-1 text-[0.72rem] text-muted">
                    The status auto-updates from the balance when this changes.
                  </p>
                </Field>
              </section>

              {/* 8 · Invoice preview */}
              <section className="flex flex-col gap-3" data-no-vitality>
                <SectionTitle>8 · Invoice preview</SectionTitle>
                <div
                  className="mono rounded-xl border px-4 py-4 text-[0.78rem] tabular-nums"
                  style={{
                    borderColor: "var(--color-border-strong)",
                    background: "var(--color-card)",
                  }}
                >
                  {(
                    [
                      ["Top", totals.topTotalMetres, toNum(topRate), totals.topAmount],
                      ["Bottom", totals.bottomTotalMetres, toNum(bottomRate), totals.bottomAmount],
                      ["Dupatta", totals.dupattaTotalMetres, toNum(dupattaRate), totals.dupattaAmount],
                    ] as Array<[string, number, number, number]>
                  ).map(([name, m, rate, amount]) => (
                    <PreviewLine
                      key={name}
                      label={name}
                      detail={`${metres(m)} × ₹${rate.toFixed(2)}`}
                      value={rupees(amount)}
                    />
                  ))}
                  <PreviewDivider />
                  <PreviewLine label="Subtotal" value={rupees(totals.subtotal)} />
                  <PreviewLine
                    label={`Discount ${toNum(discount)}%`}
                    value={<>-{rupees(totals.discountAmount)}</>}
                  />
                  <PreviewLine
                    label="After discount"
                    value={rupees(totals.afterDiscount)}
                  />
                  <PreviewLine
                    label={gst ? "GST 5%" : "GST"}
                    value={gst ? <>+{rupees(totals.gstAmount)}</> : rupees(0)}
                  />
                  <PreviewDivider />
                  <PreviewLine
                    label="Total"
                    value={rupees(totals.totalAmount)}
                    strong
                  />
                  {toNum(cdPercent) > 0 && (
                    <PreviewLine
                      label={`CD ${toNum(cdPercent)}%`}
                      value={<>-{rupees(totals.cdAmount)}</>}
                    />
                  )}
                  <PreviewLine
                    label="Net payable"
                    value={rupees(totals.netPayable)}
                    strong
                  />
                  <PreviewLine
                    label="Due date"
                    value={ddmmyyyy(dueDate)}
                  />
                </div>
              </section>

              {error && (
                <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              )}

              <button
                type="button"
                className="btn-primary w-full"
                disabled={!canSave}
                onClick={save}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {rateCardPrompt && (
        <RateCardPrompt
          partyName={rateCardPrompt.partyName}
          itemName={rateCardPrompt.itemName}
          onYes={onUpdateRateCard}
          onNo={finishAfterPrompt}
          onJustThis={finishAfterPrompt}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

function PreviewLine({
  label,
  detail,
  value,
  strong,
}: {
  label: string;
  detail?: string;
  value: ReactNode;
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

function PreviewDivider() {
  return (
    <div
      className="my-2 border-t border-dashed"
      style={{ borderColor: "var(--color-border)" }}
      aria-hidden
    />
  );
}

function RateCardPrompt({
  partyName,
  itemName,
  onYes,
  onNo,
  onJustThis,
}: {
  partyName: string;
  itemName: string;
  onYes: () => void;
  onNo: () => void;
  onJustThis: () => void;
}) {
  return (
    <BottomSheet title="Saved rates" onClose={onNo}>
      <p className="mt-3 text-base text-fg">
        Update saved rates for {partyName} on {itemName}?
      </p>
      <p className="mt-2 text-sm text-muted">
        The order is saved. This only changes the rates auto-filled next time.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        <button type="button" className="btn-primary w-full" onClick={onYes}>
          Yes, update rates
        </button>
        <button
          type="button"
          data-no-vitality
          onClick={onJustThis}
          className="w-full rounded-full border bg-transparent px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "var(--color-border-strong)",
            color: "var(--color-fg)",
          }}
        >
          Just this order
        </button>
        <button
          type="button"
          data-no-vitality
          onClick={onNo}
          className="w-full rounded-full border-0 bg-transparent px-4 py-2 text-sm font-medium text-muted"
        >
          No
        </button>
      </div>
    </BottomSheet>
  );
}
