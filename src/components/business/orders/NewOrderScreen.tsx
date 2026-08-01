"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { pushToast } from "@/lib/toast";
import { useCountUp } from "@/lib/motion";
import BottomSheet from "@/components/vitals/BottomSheet";
import { fetchItemMaster, type ItemMasterEntry } from "@/lib/supabase/lots";
import {
  computeDueDate,
  computeTotals,
  createOrder,
  createParty,
  fetchActiveLotOptions,
  fetchParties,
  fetchRateCard,
  upsertRateCard,
  type ActiveLotOption,
  type OrderTotals,
  type PartyEntry,
} from "@/lib/supabase/orders";
import { ddmmyyyy, metres, rupees } from "./orderFormat";

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Local YYYY-MM-DD (matches how order_date is stored). */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const inputFull = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "var(--radius-sm)",
} as const;

/**
 * /business/orders/new — the full-screen order entry form. Item + lot picker
 * (lots filtered to the selected item, remaining stock shown), party picker
 * with inline add, per-colour quantities with a colour stepper, live-computed
 * metre totals, editable rates auto-filled from a saved rate card, terms
 * (discount / GST / payment days), and a live invoice preview. On save it
 * inserts the order (the lot-status trigger fires in Postgres), reconciles the
 * rate card, toasts, and routes back to the list.
 */
export default function NewOrderScreen() {
  const router = useRouter();

  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [lots, setLots] = useState<ActiveLotOption[]>([]);
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Section 1 — order date
  const [orderDate, setOrderDate] = useState(() => localISODate(new Date()));

  // Section 2 — item + lot
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [lotId, setLotId] = useState<string | null>(null);

  // Section 2 — party
  const [party, setParty] = useState<PartyEntry | null>(null);

  // Section 3 — quantities
  const [topPer, setTopPer] = useState("");
  const [bottomPer, setBottomPer] = useState("");
  const [dupattaPer, setDupattaPer] = useState("");
  const [numColours, setNumColours] = useState(1);

  // Section 4 — rates
  const [topRate, setTopRate] = useState("");
  const [bottomRate, setBottomRate] = useState("");
  const [dupattaRate, setDupattaRate] = useState("");
  const [ratesApplied, setRatesApplied] = useState(false);

  // Section 5 — terms
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState(false);
  const [paymentDays, setPaymentDays] = useState("45");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCardPrompt, setRateCardPrompt] = useState<{
    orderId: string;
    toast: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchItemMaster(),
      fetchActiveLotOptions(),
      fetchParties(),
    ]).then(([i, l, p]) => {
      setItems(i);
      setLots(l);
      setParties(p);
      setLoaded(true);
    });
  }, []);

  // Lots available for the chosen item — match by item id when we have it,
  // otherwise fall back to the denormalised item name.
  const lotsForItem = useMemo(() => {
    if (!itemId && !itemName.trim()) return [];
    const name = itemName.trim().toLowerCase();
    return lots.filter((l) =>
      itemId ? l.itemId === itemId : l.itemName.toLowerCase() === name
    );
  }, [lots, itemId, itemName]);

  const selectedLot = useMemo(
    () => lots.find((l) => l.lotId === lotId) ?? null,
    [lots, lotId]
  );

  // Picking a party applies its terms immediately (GST preference + payment
  // days); a fresh pick also clears the saved-rates badge until the rate-card
  // lookup below resolves.
  const applyParty = (p: PartyEntry) => {
    setParty(p);
    setGst(p.gstPreference === "gst");
    setPaymentDays(String(p.defaultPaymentDays || 45));
    setRatesApplied(false);
  };

  useEffect(() => {
    let cancelled = false;
    if (!party || !itemId) return;
    fetchRateCard(party.id, itemId).then((card) => {
      if (cancelled || !card) return;
      if (card.topRate != null) setTopRate(String(card.topRate));
      if (card.bottomRate != null) setBottomRate(String(card.bottomRate));
      if (card.dupattaRate != null) setDupattaRate(String(card.dupattaRate));
      setRatesApplied(true);
    });
    return () => {
      cancelled = true;
    };
  }, [party, itemId]);

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
        cdPercent: party?.cdPercent ?? 0,
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
      party,
    ]
  );

  const dueDate = useMemo(
    () => computeDueDate(orderDate, toNum(paymentDays)),
    [orderDate, paymentDays]
  );

  const canSave =
    !!lotId &&
    !!party &&
    totals.totalMetres > 0 &&
    !saving;

  const save = async () => {
    if (!canSave || !selectedLot || !party) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createOrder({
        orderDate,
        lotId: selectedLot.lotId,
        itemId: selectedLot.itemId ?? itemId,
        itemName: selectedLot.itemName || itemName.trim(),
        dNo: selectedLot.dNo,
        partyId: party.id,
        partyName: party.partyName,
        topPerColour: toNum(topPer),
        bottomPerColour: toNum(bottomPer),
        dupattaPerColour: toNum(dupattaPer),
        numColours,
        topRate: toNum(topRate),
        bottomRate: toNum(bottomRate),
        dupattaRate: toNum(dupattaRate),
        discountPercent: toNum(discount),
        gstApplicable: gst,
        cdPercent: party.cdPercent,
        paymentDays: toNum(paymentDays),
      });

      const toast = `Order logged — ${rupees(result.totals.netPayable)} · ${
        party.partyName
      }${selectedLot.dNo ? ` · ${selectedLot.dNo}` : ""}`;

      // Existing rate card whose rates changed → prompt before leaving.
      if (result.rateCardChanged && selectedLot.itemId) {
        setSaving(false);
        setRateCardPrompt({ orderId: result.orderId, toast });
        return;
      }

      pushToast(toast);
      router.push("/business/orders");
    } catch {
      setError("Couldn't save the order. Check your connection and try again.");
      setSaving(false);
    }
  };

  const finishAfterPrompt = () => {
    if (rateCardPrompt) pushToast(rateCardPrompt.toast);
    router.push("/business/orders");
  };

  const onUpdateRateCard = async () => {
    if (party && selectedLot?.itemId) {
      try {
        await upsertRateCard(party.id, selectedLot.itemId, {
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

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-32 pt-6 md:max-w-lg md:px-8">
      <BackHeading onBack={() => router.push("/business/orders")} />

      {!loaded ? (
        <div className="mt-6 space-y-4" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
            <SectionTitle>Date</SectionTitle>
            <Field label="Order date">
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="mono w-full"
                data-no-vitality
                style={inputFull}
              />
              <p className="mt-1.5 text-[0.72rem] text-muted">
                Due date = order date + payment days.
              </p>
            </Field>
          </section>

          <ItemLotSection
            items={items}
            lotsForItem={lotsForItem}
            itemId={itemId}
            itemName={itemName}
            lotId={lotId}
            selectedLot={selectedLot}
            onPickItem={(id, name) => {
              setItemId(id);
              setItemName(name);
              setLotId(null);
              setRatesApplied(false);
            }}
            onPickLot={setLotId}
          />

          <PartySection
            parties={parties}
            party={party}
            ratesApplied={ratesApplied}
            onPickParty={applyParty}
            onPartyCreated={(p) => {
              setParties((prev) =>
                [...prev, p].sort((a, b) =>
                  a.partyName.localeCompare(b.partyName)
                )
              );
              applyParty(p);
            }}
          />

          <QuantitySection
            topPer={topPer}
            bottomPer={bottomPer}
            dupattaPer={dupattaPer}
            numColours={numColours}
            totals={totals}
            lot={selectedLot}
            onTop={setTopPer}
            onBottom={setBottomPer}
            onDupatta={setDupattaPer}
            onColours={setNumColours}
          />

          <RatesSection
            topRate={topRate}
            bottomRate={bottomRate}
            dupattaRate={dupattaRate}
            onTop={setTopRate}
            onBottom={setBottomRate}
            onDupatta={setDupattaRate}
          />

          <TermsSection
            discount={discount}
            gst={gst}
            paymentDays={paymentDays}
            onDiscount={setDiscount}
            onGst={setGst}
            onPaymentDays={setPaymentDays}
          />

          <InvoicePreview
            totals={totals}
            discountPercent={toNum(discount)}
            gst={gst}
            cdPercent={party?.cdPercent ?? 0}
            paymentDays={toNum(paymentDays)}
            dueDate={dueDate}
            rates={{
              top: toNum(topRate),
              bottom: toNum(bottomRate),
              dupatta: toNum(dupattaRate),
            }}
          />

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
            {saving ? "Logging…" : "Log Order →"}
          </button>
        </div>
      )}

      {rateCardPrompt && party && selectedLot && (
        <RateCardPrompt
          partyName={party.partyName}
          itemName={selectedLot.itemName}
          onYes={onUpdateRateCard}
          onNo={finishAfterPrompt}
          onJustThis={finishAfterPrompt}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">
      {children}
    </p>
  );
}

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

/** A metre figure that counts up whenever its value changes. */
function CountUpMetres({ value }: { value: number }) {
  const display = useCountUp(value, { duration: 400 });
  return <>{metres(display)}</>;
}

/** A rupee figure that counts up whenever its value changes. */
function CountUpRupees({ value }: { value: number }) {
  const display = useCountUp(value, { duration: 400 });
  return <>{rupees(display)}</>;
}

function BackHeading({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-no-vitality
        aria-label="Back to orders"
        onClick={onBack}
        className="rounded-full border-0 bg-transparent p-1.5 text-muted-strong transition-colors hover:text-fg"
      >
        <ArrowLeft size={20} aria-hidden />
      </button>
      <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
        Log Order
      </h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — item + lot
// ---------------------------------------------------------------------------

function ItemLotSection({
  items,
  lotsForItem,
  itemId,
  itemName,
  lotId,
  selectedLot,
  onPickItem,
  onPickLot,
}: {
  items: ItemMasterEntry[];
  lotsForItem: ActiveLotOption[];
  itemId: string | null;
  itemName: string;
  lotId: string | null;
  selectedLot: ActiveLotOption | null;
  onPickItem: (id: string | null, name: string) => void;
  onPickLot: (lotId: string | null) => void;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, itemName]);

  const itemChosen = itemId !== null;

  return (
    <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <SectionTitle>1 · Item &amp; lot</SectionTitle>

      <Field label="Item">
        <div className="relative">
          <input
            type="text"
            value={itemName}
            placeholder="Search items"
            onChange={(e) => {
              onPickItem(null, e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            className="w-full"
            data-no-vitality
            style={inputFull}
          />
          {pickerOpen && filteredItems.length > 0 && (
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
                    onMouseDown={() => {
                      onPickItem(i.id, i.itemName);
                      setPickerOpen(false);
                    }}
                  >
                    {i.itemName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {itemChosen && lotsForItem.length === 0 ? (
        <div
          className="rounded-xl border px-4 py-4 text-sm"
          style={{
            borderColor: "var(--color-amber)",
            background: "rgba(245, 158, 11, 0.06)",
            color: "var(--color-muted-strong)",
          }}
        >
          <p>No active lots for this item. Add a lot first.</p>
          <button
            type="button"
            data-no-vitality
            onClick={() => router.push("/business/lots")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-transparent px-3.5 py-1.5 text-[0.78rem] font-medium"
            style={{
              borderColor: "var(--color-amber)",
              color: "var(--color-amber)",
            }}
          >
            <Plus size={13} aria-hidden />
            Add Lot
          </button>
        </div>
      ) : (
        <Field label="Lot / D.No.">
          <select
            value={lotId ?? ""}
            disabled={!itemChosen && !itemName.trim()}
            onChange={(e) => onPickLot(e.target.value || null)}
            className="mono w-full"
            data-no-vitality
            style={inputFull}
          >
            <option value="">
              {itemChosen || itemName.trim()
                ? "Select a lot"
                : "Pick an item first"}
            </option>
            {lotsForItem.map((l) => (
              <option key={l.lotId} value={l.lotId}>
                {`${l.dNo || "No D.No."} — Top: ${metres(
                  l.topRemaining
                )} · Bot: ${metres(l.bottomRemaining)} · Dup: ${metres(
                  l.dupattaRemaining
                )} remaining`}
              </option>
            ))}
          </select>
        </Field>
      )}

      {selectedLot && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-card)",
          }}
        >
          {selectedLot.designPhotoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={selectedLot.designPhotoUrl}
              alt={`Design ${selectedLot.dNo}`}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed text-[0.58rem] uppercase tracking-wider text-muted"
              style={{ borderColor: "var(--color-border-strong)" }}
              aria-hidden
            >
              No photo
            </div>
          )}
          <div className="min-w-0">
            <p className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
              D.No.
            </p>
            <p className="mono text-base font-semibold text-fg">
              {selectedLot.dNo || "—"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — party
// ---------------------------------------------------------------------------

function PartySection({
  parties,
  party,
  ratesApplied,
  onPickParty,
  onPartyCreated,
}: {
  parties: PartyEntry[];
  party: PartyEntry | null;
  ratesApplied: boolean;
  onPickParty: (p: PartyEntry) => void;
  onPartyCreated: (p: PartyEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingName, setAddingName] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = party ? party.partyName : query;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) => p.partyName.toLowerCase().includes(q));
  }, [parties, query]);

  const exactMatch = parties.some(
    (p) => p.partyName.toLowerCase() === query.trim().toLowerCase()
  );

  const saveParty = async () => {
    if (!addingName || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createParty({
        partyName: addingName,
        area: area.trim() || null,
        city: city.trim() || null,
      });
      setAddingName(null);
      setArea("");
      setCity("");
      setQuery("");
      onPartyCreated(created);
    } catch {
      setError("Couldn't save the party. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>2 · Party</SectionTitle>
        {ratesApplied && (
          <span
            className="mono rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
          >
            Saved rates applied
          </span>
        )}
      </div>

      <Field label="Party">
        <div className="relative">
          <input
            type="text"
            value={shown}
            placeholder="Search or type a new party"
            onChange={(e) => {
              setQuery(e.target.value);
              setPickerOpen(true);
              setAddingName(null);
            }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            className="w-full"
            data-no-vitality
            style={inputFull}
          />
          {pickerOpen && !party && query.trim() && (
            <ul
              className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border shadow-lg"
              style={{
                borderColor: "var(--color-border-strong)",
                background: "var(--color-bg-elevated)",
              }}
            >
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-no-vitality
                    className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm text-fg hover:bg-white/[0.05]"
                    onMouseDown={() => {
                      onPickParty(p);
                      setQuery("");
                      setPickerOpen(false);
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
              {!exactMatch && (
                <li>
                  <button
                    type="button"
                    data-no-vitality
                    className="w-full border-0 bg-transparent px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                    style={{ color: "var(--accent)" }}
                    onMouseDown={() => {
                      setAddingName(query.trim());
                      setPickerOpen(false);
                    }}
                  >
                    Add &ldquo;{query.trim()}&rdquo; as new party
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
          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          )}
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
              disabled={saving}
              onClick={saveParty}
            >
              {saving ? "Saving…" : "Save party"}
            </button>
          </div>
        </div>
      )}

      {party && (
        <p className="mono text-[0.7rem] text-muted">
          {[party.area, party.city].filter(Boolean).join(", ") || "—"} ·{" "}
          {party.defaultPaymentDays} days
          {party.cdPercent > 0 ? ` · CD ${party.cdPercent}%` : ""}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — quantities + live metre totals
// ---------------------------------------------------------------------------

function QuantitySection({
  topPer,
  bottomPer,
  dupattaPer,
  numColours,
  totals,
  lot,
  onTop,
  onBottom,
  onDupatta,
  onColours,
}: {
  topPer: string;
  bottomPer: string;
  dupattaPer: string;
  numColours: number;
  totals: OrderTotals;
  lot: ActiveLotOption | null;
  onTop: (v: string) => void;
  onBottom: (v: string) => void;
  onDupatta: (v: string) => void;
  onColours: (n: number) => void;
}) {
  const rows: Array<[string, string, (v: string) => void]> = [
    ["Top", topPer, onTop],
    ["Bottom", bottomPer, onBottom],
    ["Dupatta", dupattaPer, onDupatta],
  ];

  const totalLines: Array<[string, number, number, number | null]> = [
    ["Top", toNum(topPer), totals.topTotalMetres, lot?.topRemaining ?? null],
    [
      "Bottom",
      toNum(bottomPer),
      totals.bottomTotalMetres,
      lot?.bottomRemaining ?? null,
    ],
    [
      "Dupatta",
      toNum(dupattaPer),
      totals.dupattaTotalMetres,
      lot?.dupattaRemaining ?? null,
    ],
  ];

  const warnings = totalLines
    .filter(([, , total, remaining]) => remaining !== null && total > remaining)
    .map(
      ([name, , , remaining]) =>
        `${name}: only ${metres(remaining as number)} remaining in this lot`
    );

  return (
    <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <SectionTitle>3 · Quantity</SectionTitle>

      {rows.map(([label, value, set]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-fg">{label}</span>
          <label className="flex items-center gap-2">
            <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
              Per colour (m):
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="mono w-28 text-center tabular-nums"
              data-no-vitality
              style={{ ...inputFull, fontSize: 20 }}
            />
          </label>
        </div>
      ))}

      {/* colours stepper */}
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
            onClick={() => onColours(Math.max(1, numColours - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-transparent text-fg disabled:opacity-40"
            style={{ borderColor: "var(--color-border-strong)" }}
          >
            <Minus size={16} aria-hidden />
          </button>
          <span className="mono w-10 text-center text-2xl font-semibold tabular-nums text-fg">
            {numColours}
          </span>
          <button
            type="button"
            data-no-vitality
            aria-label="More colours"
            onClick={() => onColours(numColours + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-transparent text-fg"
            style={{ borderColor: "var(--color-border-strong)" }}
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* live totals */}
      <div className="card-raised mono px-4 py-4 text-[0.8rem] tabular-nums">
        {totalLines.map(([name, per, total]) => (
          <div
            key={name}
            className="flex items-baseline justify-between gap-3 py-1"
          >
            <span className="text-muted-strong">
              {name}:{" "}
              <span className="text-muted">
                {metres(per)} × {numColours} colour{numColours === 1 ? "" : "s"}
              </span>
            </span>
            <span className="font-semibold text-fg">
              <CountUpMetres value={total} />
            </span>
          </div>
        ))}
        <div
          className="my-2 border-t border-dashed"
          style={{ borderColor: "var(--color-border)" }}
          aria-hidden
        />
        <div className="flex items-baseline justify-between gap-3 py-1">
          <span className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-strong">
            Total
          </span>
          <span
            className="text-lg font-semibold"
            style={{ color: "var(--accent)" }}
          >
            <CountUpMetres value={totals.totalMetres} />
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--color-amber)",
            background: "rgba(245, 158, 11, 0.06)",
            color: "var(--color-amber)",
          }}
        >
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — rates
// ---------------------------------------------------------------------------

function RatesSection({
  topRate,
  bottomRate,
  dupattaRate,
  onTop,
  onBottom,
  onDupatta,
}: {
  topRate: string;
  bottomRate: string;
  dupattaRate: string;
  onTop: (v: string) => void;
  onBottom: (v: string) => void;
  onDupatta: (v: string) => void;
}) {
  const rows: Array<[string, string, (v: string) => void]> = [
    ["Top rate", topRate, onTop],
    ["Bottom rate", bottomRate, onBottom],
    ["Dupatta rate", dupattaRate, onDupatta],
  ];

  return (
    <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <SectionTitle>4 · Rates (₹/m)</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {rows.map(([label, value, set]) => (
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
  );
}

// ---------------------------------------------------------------------------
// Section 5 — terms
// ---------------------------------------------------------------------------

function TermsSection({
  discount,
  gst,
  paymentDays,
  onDiscount,
  onGst,
  onPaymentDays,
}: {
  discount: string;
  gst: boolean;
  paymentDays: string;
  onDiscount: (v: string) => void;
  onGst: (v: boolean) => void;
  onPaymentDays: (v: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <SectionTitle>5 · Terms</SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Discount %">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => onDiscount(e.target.value)}
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
            onChange={(e) => onPaymentDays(e.target.value)}
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
                onClick={() => onGst(value)}
                className="rounded-full border-0 px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-ink)" : "var(--color-muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 6 — live invoice preview
// ---------------------------------------------------------------------------

function InvoicePreview({
  totals,
  discountPercent,
  gst,
  cdPercent,
  paymentDays,
  dueDate,
  rates,
}: {
  totals: OrderTotals;
  discountPercent: number;
  gst: boolean;
  cdPercent: number;
  paymentDays: number;
  dueDate: string;
  rates: { top: number; bottom: number; dupatta: number };
}) {
  const components: Array<[string, number, number, number]> = [
    ["Top", totals.topTotalMetres, rates.top, totals.topAmount],
    ["Bottom", totals.bottomTotalMetres, rates.bottom, totals.bottomAmount],
    ["Dupatta", totals.dupattaTotalMetres, rates.dupatta, totals.dupattaAmount],
  ];

  return (
    <section className="flex flex-col gap-3 border-0 bg-transparent p-0 shadow-none" data-no-vitality>
      <SectionTitle>6 · Invoice preview</SectionTitle>
      <div
        className="mono rounded-xl border px-4 py-4 text-[0.78rem] tabular-nums"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-card)",
        }}
      >
        {components.map(([name, m, rate, amount]) => (
          <PreviewLine
            key={name}
            label={name}
            detail={`${metres(m)} × ₹${rate.toFixed(2)}`}
            value={<CountUpRupees value={amount} />}
          />
        ))}

        <PreviewDivider />
        <PreviewLine
          label="Subtotal"
          value={<CountUpRupees value={totals.subtotal} />}
        />
        <PreviewLine
          label={`Discount ${discountPercent}%`}
          value={
            <>
              -<CountUpRupees value={totals.discountAmount} />
            </>
          }
        />
        <PreviewLine
          label="After discount"
          value={<CountUpRupees value={totals.afterDiscount} />}
        />
        <PreviewLine
          label={gst ? "GST 5%" : "GST"}
          value={
            gst ? (
              <>
                +<CountUpRupees value={totals.gstAmount} />
              </>
            ) : (
              rupees(0)
            )
          }
        />
        <PreviewDivider />
        <div className="flex items-baseline justify-between gap-3 py-1">
          <span className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-strong">
            Total
          </span>
          <span
            className="text-lg font-semibold"
            style={{ color: "var(--accent)" }}
          >
            <CountUpRupees value={totals.totalAmount} />
          </span>
        </div>
        {cdPercent > 0 && (
          <PreviewLine
            label={`CD ${cdPercent}% (if paid in ${paymentDays} days)`}
            value={
              <>
                -<CountUpRupees value={totals.cdAmount} />
              </>
            }
          />
        )}
        <PreviewLine
          label="Net payable"
          value={<CountUpRupees value={totals.netPayable} />}
          strong
        />
        <PreviewLine label="Due date" value={ddmmyyyy(dueDate)} />
      </div>
    </section>
  );
}

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

// ---------------------------------------------------------------------------
// Rate card prompt — shown after save when a saved card's rates changed
// ---------------------------------------------------------------------------

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
