"use client";

import { useEffect, useState } from "react";
import { useSheet } from "@/lib/useSheet";

const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
} as const;

/**
 * Bottom sheet to edit rate card for a party + item pair.
 * Three inputs: Top rate, Bottom rate, Dupatta rate per metre.
 */
export default function EditRateSheet({
  card,
  onSave,
  onClose,
}: {
  card: { itemName: string | null; topRate: number | null; bottomRate: number | null; dupattaRate: number | null };
  onSave: (rates: { topRate: number; bottomRate: number; dupattaRate: number }) => void;
  onClose: () => void;
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

  const [topRate, setTopRate] = useState<string>(card.topRate !== null ? String(card.topRate) : "");
  const [bottomRate, setBottomRate] = useState<string>(card.bottomRate !== null ? String(card.bottomRate) : "");
  const [dupattaRate, setDupattaRate] = useState<string>(card.dupattaRate !== null ? String(card.dupattaRate) : "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const canSave = topRate.trim() !== "" && bottomRate.trim() !== "" && dupattaRate.trim() !== "";

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      onSave({
        topRate: Number(topRate) || 0,
        bottomRate: Number(bottomRate) || 0,
        dupattaRate: Number(dupattaRate) || 0,
      });
    } catch {
      setError("Couldn't save rates.");
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
        className={`relative flex h-[50dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="Edit rates"
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
              Edit rates
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
            {card.itemName ?? "Item"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Top (₹/m)">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={topRate}
                onChange={(e) => setTopRate(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
            </Field>
            <Field label="Bottom (₹/m)">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={bottomRate}
                onChange={(e) => setBottomRate(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
            </Field>
            <Field label="Dupatta (₹/m)">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={dupattaRate}
                onChange={(e) => setDupattaRate(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
            </Field>
          </div>

          {error && (
            <p className="mt-4 text-sm" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canSave || saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save Rates"}
            </button>
          </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
