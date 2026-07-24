"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { FileText, ImagePlus, PencilLine, ScanLine } from "lucide-react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import {
  createLot,
  fetchItemMaster,
  type ItemMasterEntry,
} from "@/lib/supabase/lots";

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

type ScanPhase = "idle" | "loading" | "done" | "failed";

interface ScanResponse {
  top_metres: number | null;
  bottom_metres: number | null;
  dupatta_metres: number | null;
  item_name: string | null;
  d_no: string | null;
  error?: string;
}

const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
} as const;

/**
 * The "+ New Lot" flow: a full-screen bottom sheet (rides the shared useSheet
 * slide-up/down motion) with three steps — design photo + D.No, stock entry
 * (scan the lot report via /api/scan-lot-report, or type it), and optional
 * cost prices + low-stock threshold. Saving uploads both files to Storage,
 * inserts the lot (adding a new item_master row if the item name is new),
 * toasts, and hands the new lot id to the parent for navigation.
 */
export default function NewLotSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (lotId: string) => void;
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

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dNo, setDNo] = useState("");

  // Step 2
  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [itemId, setItemId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [dupatta, setDupatta] = useState("");
  const [report, setReport] = useState<File | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanNote, setScanNote] = useState<string | null>(null);

  // Step 3
  const [topCost, setTopCost] = useState("");
  const [bottomCost, setBottomCost] = useState("");
  const [dupattaCost, setDupattaCost] = useState("");
  const [threshold, setThreshold] = useState("100");

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

  const onPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(await readAsDataUrl(file));
  };

  const onReportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReport(file);
    setScanPhase("loading");
    setScanNote(null);

    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await fetch("/api/scan-lot-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const payload = (await res.json().catch(() => null)) as ScanResponse | null;

      if (!res.ok || !payload) {
        setScanPhase("failed");
        setScanNote(
          payload?.error ??
            "Couldn't read the report — please enter manually."
        );
        return;
      }

      if (payload.top_metres != null) setTop(String(payload.top_metres));
      if (payload.bottom_metres != null) setBottom(String(payload.bottom_metres));
      if (payload.dupatta_metres != null)
        setDupatta(String(payload.dupatta_metres));
      if (payload.item_name && !itemQuery) setItemQuery(payload.item_name);
      if (payload.d_no && !dNo.trim()) setDNo(payload.d_no);
      setScanPhase("done");
    } catch {
      setScanPhase("failed");
      setScanNote("Couldn't read the report — please enter manually.");
    }
  };

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, itemQuery]);

  const exactMatch = items.find(
    (i) => i.itemName.toLowerCase() === itemQuery.trim().toLowerCase()
  );

  const canNext2 =
    itemQuery.trim().length > 0 &&
    (toNum(top) > 0 || toNum(bottom) > 0 || toNum(dupatta) > 0);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const itemName = itemQuery.trim();
      const lotId = await createLot({
        itemId: exactMatch?.id ?? itemId,
        itemName,
        dNo,
        designPhoto: photo,
        lotReport: report,
        topMetres: toNum(top),
        bottomMetres: toNum(bottom),
        dupattaMetres: toNum(dupatta),
        topCost: topCost.trim() ? toNum(topCost) : null,
        bottomCost: bottomCost.trim() ? toNum(bottomCost) : null,
        dupattaCost: dupattaCost.trim() ? toNum(dupattaCost) : null,
        threshold: threshold.trim() ? toNum(threshold) : 100,
      });
      pushToast(`${itemName} ${dNo.trim()}`.trim() + " added.");
      onSaved(lotId);
    } catch {
      setError("Couldn't save the lot. Check your connection and try again.");
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
        className={`relative flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="New lot"
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
              New lot · Step {step} of 3
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
            {step === 1
              ? "Design photo"
              : step === 2
                ? "Stock entry"
                : "Costs & alerts"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center"
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
                    className="max-h-56 w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <ImagePlus
                      size={28}
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

              <Field label="D.No.">
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

              <button type="button" className="btn-primary w-full" onClick={() => setStep(2)}>
                Next →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* Option A — scan */}
              <div className="grid grid-cols-2 gap-3">
                <OptionCard
                  icon={<ScanLine size={18} aria-hidden />}
                  title="Scan lot report"
                  active={scanPhase !== "idle" && scanPhase !== "failed"}
                >
                  <label
                    className="mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-medium"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  >
                    <FileText size={13} aria-hidden />
                    {report ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      data-no-vitality
                      onChange={onReportChange}
                    />
                  </label>
                </OptionCard>

                {/* Option B — manual */}
                <OptionCard
                  icon={<PencilLine size={18} aria-hidden />}
                  title="Manual entry"
                  active={scanPhase === "idle" || scanPhase === "failed"}
                >
                  <p className="mt-2 text-[0.72rem] leading-snug text-muted">
                    Type the figures into the fields below.
                  </p>
                </OptionCard>
              </div>

              {scanPhase === "loading" && (
                <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                  <span
                    className="h-5 w-5 shrink-0 animate-spin rounded-full border-2"
                    style={{
                      borderColor: "var(--color-border-strong)",
                      borderTopColor: "var(--accent)",
                    }}
                    aria-hidden
                  />
                  <p className="text-sm text-muted-strong">
                    Reading your lot report...
                  </p>
                </div>
              )}
              {scanPhase === "done" && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--accent)",
                    background: "rgb(var(--accent-rgb) / 0.06)",
                    color: "var(--color-muted-strong)",
                  }}
                >
                  Read from your report — confirm or edit below
                </div>
              )}
              {scanPhase === "failed" && scanNote && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--color-amber)",
                    background: "rgba(245, 158, 11, 0.06)",
                    color: "var(--color-muted-strong)",
                  }}
                >
                  {scanNote}
                </div>
              )}

              {/* Item name — searchable dropdown over item_master */}
              <Field label="Item Name">
                <div className="relative">
                  <input
                    type="text"
                    value={itemQuery}
                    placeholder="Search or type a new item"
                    onChange={(e) => {
                      setItemQuery(e.target.value);
                      setItemId(null);
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
                                setItemId(i.id);
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
                              onMouseDown={() => {
                                setItemId(null);
                                setPickerOpen(false);
                              }}
                            >
                              Add “{itemQuery.trim()}” as new item
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                </div>
              </Field>

              <Field label="D.No.">
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

              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Top (m)", top, setTop],
                    ["Bottom (m)", bottom, setBottom],
                    ["Dupatta (m)", dupatta, setDupatta],
                  ] as Array<[string, string, (v: string) => void]>
                ).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="mono w-full text-center tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  data-no-vitality
                  onClick={() => setStep(1)}
                  className="rounded-full border px-5 py-3 text-sm font-medium"
                  style={{
                    borderColor: "var(--color-border-strong)",
                    background: "transparent",
                    color: "var(--color-muted-strong)",
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={!canNext2}
                  onClick={() => setStep(3)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Cost price per metre (optional — for profitability tracking)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Top ₹/m", topCost, setTopCost],
                    ["Bottom ₹/m", bottomCost, setBottomCost],
                    ["Dupatta ₹/m", dupattaCost, setDupattaCost],
                  ] as Array<[string, string, (v: string) => void]>
                ).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="mono w-full text-center tabular-nums"
                      data-no-vitality
                      style={inputFull}
                    />
                  </Field>
                ))}
              </div>

              <Field label="Low stock alert threshold">
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
                <p className="mt-1.5 text-[0.72rem] text-muted">
                  Alert me when any component falls below {threshold || "___"}{" "}
                  metres
                </p>
              </Field>

              {error && (
                <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  data-no-vitality
                  onClick={() => setStep(2)}
                  className="rounded-full border px-5 py-3 text-sm font-medium"
                  style={{
                    borderColor: "var(--color-border-strong)",
                    background: "transparent",
                    color: "var(--color-muted-strong)",
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save Lot"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function OptionCard({
  icon,
  title,
  active,
  children,
}: {
  icon: ReactNode;
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{
        borderColor: active ? "var(--accent)" : "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <div
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: active ? "var(--accent)" : "var(--color-muted-strong)" }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
