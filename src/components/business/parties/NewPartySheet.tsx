"use client";

import { useEffect, useState } from "react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import { createParty } from "@/lib/supabase/parties";

const inputStyle = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
} as const;

/**
 * Bottom sheet for adding a new party. Fields:
 * - Party name (required)
 * - Area (optional)
 * - City (optional)
 * - Default payment days (number, default 45)
 * - Discount % (number, default 0)
 * - CD % (number, default 0)
 * - GST preference (toggle: Non-GST / GST)
 * - Notes (optional)
 */
export default function NewPartySheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (partyId: string) => void;
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

  const [partyName, setPartyName] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [defaultPaymentDays, setDefaultPaymentDays] = useState("45");
  const [defaultDiscountPercent, setDefaultDiscountPercent] = useState("0");
  const [cdPercent, setCdPercent] = useState("0");
  const [gstPreference, setGstPreference] = useState<"gst" | "non_gst">("non_gst");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const canSave = partyName.trim().length > 0;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const partyId = await createParty({
        partyName: partyName.trim(),
        area: area.trim() || null,
        city: city.trim() || null,
        defaultPaymentDays: Number(defaultPaymentDays) || 45,
        defaultDiscountPercent: Number(defaultDiscountPercent) || 0,
        cdPercent: Number(cdPercent) || 0,
        gstPreference,
        notes: notes.trim() || null,
      });
      pushToast(`${partyName.trim()} added.`);
      onSaved(partyId);
    } catch (err) {
      setError("Couldn't save the party. Check your connection and try again.");
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
        aria-label="Add party"
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
              Add new party
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
            Party details
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4">
          {/* Party name */}
          <Field label="Party name *" required>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g.ABC Traders"
              className="w-full"
              data-no-vitality
              style={inputFull}
            />
          </Field>

          {/* Area and City */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Area">
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Shahad"
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
                placeholder="e.g. Mumbai"
                className="w-full"
                data-no-vitality
                style={inputFull}
              />
            </Field>
          </div>

          {/* Payment days, discount and CD */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Payment days">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={defaultPaymentDays}
                onChange={(e) => setDefaultPaymentDays(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
              <p className="mt-1.5 text-[0.68rem] leading-tight text-muted">
                Days to pay
              </p>
            </Field>
            <Field label="Discount %">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={defaultDiscountPercent}
                onChange={(e) => setDefaultDiscountPercent(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
              <p className="mt-1.5 text-[0.68rem] leading-tight text-muted">
                Trade discount
              </p>
            </Field>
            <Field label="CD %">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={cdPercent}
                onChange={(e) => setCdPercent(e.target.value)}
                className="mono w-full text-center tabular-nums"
                data-no-vitality
                style={inputFull}
              />
              <p className="mt-1.5 text-[0.68rem] leading-tight text-muted">
                Cash discount
              </p>
            </Field>
          </div>

          {/* GST preference */}
          <Field label="GST preference">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-no-vitality
                onClick={() => setGstPreference("non_gst")}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  gstPreference === "non_gst"
                    ? {
                        borderColor: "var(--accent)",
                        background: "rgb(var(--accent-rgb) / 0.06)",
                        color: "var(--accent)",
                      }
                    : {
                        borderColor: "var(--color-border)",
                        background: "transparent",
                        color: "var(--color-muted-strong)",
                      }
                }`}
              >
                Non-GST
              </button>
              <button
                type="button"
                data-no-vitality
                onClick={() => setGstPreference("gst")}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  gstPreference === "gst"
                    ? {
                        borderColor: "var(--accent)",
                        background: "rgb(var(--accent-rgb) / 0.06)",
                        color: "var(--accent)",
                      }
                    : {
                        borderColor: "var(--color-border)",
                        background: "transparent",
                        color: "var(--color-muted-strong)",
                      }
                }`}
              >
                GST
              </button>
            </div>
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this party..."
              rows={3}
              className="w-full resize-none"
              data-no-vitality
              style={inputFull}
            />
          </Field>

          {/* Error message */}
          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          {/* Save button */}
          <div className="mt-6">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canSave || saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save Party"}
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

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
        {label}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
