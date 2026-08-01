"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { ImagePlus } from "lucide-react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import {
  updateLot,
  fetchItemMaster,
  type ItemMasterEntry,
} from "@/lib/supabase/lots";
import type { LotStock, LotStatus } from "@/lib/supabase/business";

const STATUS_OPTIONS: Array<{ key: LotStatus; label: string }> = [
  { key: "arrived", label: "Arrived" },
  { key: "active", label: "Active" },
  { key: "low_stock", label: "Low Stock" },
  { key: "cleared", label: "Cleared" },
  { key: "dead_stock", label: "Dead Stock" },
];

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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

/**
 * Bottom sheet for editing a lot's core fields: item name, D.No., design photo,
 * cost prices, low-stock threshold, and status. Pre-filled from the existing
 * `LotStock` data. On save, calls `updateLot` and notifies the parent.
 */
export default function EditLotSheet({
  lot,
  onClose,
  onSaved,
}: {
  lot: LotStock;
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

  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [itemQuery, setItemQuery] = useState(lot.itemName);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dNo, setDNo] = useState(lot.dNo);
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    lot.designPhotoUrl ?? null
  );
  const [dateArrived, setDateArrived] = useState(lot.dateArrived);
  const [topOpening, setTopOpening] = useState(String(lot.top.opening));
  const [bottomOpening, setBottomOpening] = useState(String(lot.bottom.opening));
  const [dupattaOpening, setDupattaOpening] = useState(String(lot.dupatta.opening));
  const [topCost, setTopCost] = useState("");
  const [bottomCost, setBottomCost] = useState("");
  const [dupattaCost, setDupattaCost] = useState("");
  const [threshold, setThreshold] = useState(String(lot.threshold));
  const [status, setStatus] = useState<LotStatus>(lot.status);
  // Only sent to updateLot when the user actively changed it — otherwise a
  // stock/date edit recomputes the status automatically.
  const [statusTouched, setStatusTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItemMaster().then(setItems);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, itemQuery]);

  const exactMatch = items.find(
    (i) => i.itemName.toLowerCase() === itemQuery.trim().toLowerCase()
  );

  const onPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(await readAsDataUrl(file));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateLot(lot.lotId, {
        itemName: itemQuery.trim() || undefined,
        dNo: dNo !== lot.dNo ? dNo : undefined,
        designPhoto: photo ?? undefined,
        dateArrived,
        topOpeningStock: topOpening.trim() ? toNum(topOpening) : undefined,
        bottomOpeningStock: bottomOpening.trim() ? toNum(bottomOpening) : undefined,
        dupattaOpeningStock: dupattaOpening.trim() ? toNum(dupattaOpening) : undefined,
        topCost: topCost.trim() ? toNum(topCost) : undefined,
        bottomCost: bottomCost.trim() ? toNum(bottomCost) : undefined,
        dupattaCost: dupattaCost.trim() ? toNum(dupattaCost) : undefined,
        threshold: toNum(threshold),
        ...(statusTouched ? { status } : {}),
      });
      pushToast(`${lot.itemName} updated.`);
      onSaved();
    } catch {
      setError("Couldn't save changes. Check your connection and try again.");
      setSaving(false);
    }
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
        className={`relative flex h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="Edit lot"
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
              Edit lot
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
            {lot.itemName}
          </h2>
          {lot.dNo && (
            <p className="mono text-[0.72rem] uppercase tracking-[0.12em] text-muted">
              {lot.dNo}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
          <div className="flex flex-col gap-5">
            {/* Design photo */}
            <Field label="Design photo">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center"
                style={{
                  borderColor: "var(--accent)",
                  background: "var(--color-card)",
                }}
              >
                {photoPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoPreview}
                    alt="Design preview"
                    className="max-h-48 w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <ImagePlus
                      size={24}
                      aria-hidden
                      style={{ color: "var(--accent)" }}
                    />
                    <span className="text-sm text-muted-strong">
                      Upload design photo
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-no-vitality
                  onChange={onPhotoChange}
                />
                {photoPreview && (
                  <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                    Tap to replace
                  </span>
                )}
              </label>
              {lot.designPhotoUrl && !photo && (
                <button
                  type="button"
                  data-no-vitality
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  className="mono mt-1 border-0 bg-transparent text-[0.68rem] text-muted underline"
                >
                  Remove photo
                </button>
              )}
            </Field>

            {/* Item name */}
            <Field label="Item name">
              <div className="relative">
                <input
                  type="text"
                  value={itemQuery}
                  placeholder="Search or type"
                  onChange={(e) => {
                    setItemQuery(e.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                  className="w-full"
                  data-no-vitality
                  style={inputFull}
                />
                {pickerOpen &&
                  itemQuery.trim() &&
                  (filteredItems.length > 0 || !exactMatch) && (
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
                              setItemQuery(i.itemName);
                              setPickerOpen(false);
                            }}
                          >
                            {i.itemName}
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
                            onMouseDown={() => setPickerOpen(false)}
                          >
                            Use &ldquo;{itemQuery.trim()}&rdquo;
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
              </div>
            </Field>

            {/* D.No. */}
            <Field label="D.No.">
              <input
                type="text"
                value={dNo}
                placeholder={lot.dNo || "e.g. TT-247"}
                onChange={(e) => setDNo(e.target.value)}
                className="mono w-full"
                data-no-vitality
                style={inputFull}
              />
            </Field>

            {/* Date arrived */}
            <Field label="Date arrived">
              <input
                type="date"
                value={dateArrived}
                onChange={(e) => setDateArrived(e.target.value)}
                className="mono w-full"
                data-no-vitality
                style={inputFull}
              />
            </Field>

            {/* Opening stock */}
            <div>
              <p className="mono mb-2 text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                Opening stock (metres)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Top", topOpening, setTopOpening],
                    ["Bottom", bottomOpening, setBottomOpening],
                    ["Dupatta", dupattaOpening, setDupattaOpening],
                  ] as Array<[string, string, (v: string) => void]>
                ).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      placeholder="—"
                      onChange={(e) => set(e.target.value)}
                      className="mono w-full text-center tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-1.5 text-[0.72rem] leading-snug text-muted">
                The metres received at arrival. Editing this re-balances
                remaining stock and may change the lot&rsquo;s status.
              </p>
            </div>

            {/* Cost prices */}
            <div>
              <p className="mono mb-2 text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                Cost price per metre
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Top ₹/m", topCost, setTopCost] as const,
                  ["Bottom ₹/m", bottomCost, setBottomCost] as const,
                  ["Dupatta ₹/m", dupattaCost, setDupattaCost] as const,
                ].map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      placeholder="—"
                      onChange={(e) => set(e.target.value)}
                      className="mono w-full text-center tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* Threshold */}
            <Field label="Low stock alert threshold (metres)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="mono w-full tabular-nums"
                data-no-vitality
                style={inputFull}
              />
            </Field>

            {/* Status */}
            <Field label="Status">
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(({ key, label }) => {
                  const active = status === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-no-vitality
                      aria-pressed={active}
                      onClick={() => {
                        setStatus(key);
                        setStatusTouched(true);
                      }}
                      className="rounded-full border px-2.5 py-1.5 text-[0.72rem] font-medium transition-colors"
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
