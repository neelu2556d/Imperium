"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/toast";
import {
  addMeasurement,
  fetchMeasurements,
  type BodyMeasurement,
} from "@/lib/supabase/workouts";
import { displayToKg, getTrainSettings, kgToDisplay } from "@/lib/train/settings";

type FieldKey = "weight" | "body_fat_percent" | "chest_cm" | "waist_cm" | "hips_cm" | "arms_cm" | "thighs_cm";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "body_fat_percent", label: "Body fat %" },
  { key: "chest_cm", label: "Chest cm" },
  { key: "waist_cm", label: "Waist cm" },
  { key: "hips_cm", label: "Hips cm" },
  { key: "arms_cm", label: "Arms cm" },
  { key: "thighs_cm", label: "Thighs cm" },
];

/** /train/measurements — log body measurements and see recent history. */
export default function MeasurementsScreen() {
  const router = useRouter();
  const unit = getTrainSettings().unit;
  const [rows, setRows] = useState<BodyMeasurement[]>([]);
  const [vals, setVals] = useState<Record<FieldKey, string>>({
    weight: "", body_fat_percent: "", chest_cm: "", waist_cm: "", hips_cm: "", arms_cm: "", thighs_cm: "",
  });
  const [saving, setSaving] = useState(false);

  const load = () => fetchMeasurements().then(setRows);
  useEffect(() => {
    load();
  }, []);

  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v) || 0);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const w = numOrNull(vals.weight);
      await addMeasurement({
        weight_kg: w == null ? null : displayToKg(w, unit),
        body_fat_percent: numOrNull(vals.body_fat_percent),
        chest_cm: numOrNull(vals.chest_cm),
        waist_cm: numOrNull(vals.waist_cm),
        hips_cm: numOrNull(vals.hips_cm),
        arms_cm: numOrNull(vals.arms_cm),
        thighs_cm: numOrNull(vals.thighs_cm),
      });
      pushToast("Measurement logged");
      setVals({ weight: "", body_fat_percent: "", chest_cm: "", waist_cm: "", hips_cm: "", arms_cm: "", thighs_cm: "" });
      load();
    } catch {
      pushToast("Couldn't save that.");
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/train")}
          aria-label="Back"
          data-no-vitality
          className="rounded-full border p-2"
          style={{ borderColor: "var(--color-border-strong)", background: "transparent", color: "var(--color-fg)" }}
        >
          ←
        </button>
        <h1 className="serif-italic text-2xl" data-no-vitality>
          Measurements
        </h1>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border p-4" data-no-vitality style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="mono text-[0.55rem] uppercase tracking-[0.1em] text-muted">
              {f.key === "weight" ? `Weight ${unit}` : f.label}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={vals[f.key]}
              placeholder="—"
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mono tabular-nums"
              data-no-vitality
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.45rem", color: "var(--color-fg)" }}
            />
          </label>
        ))}
      </section>
      <button type="button" onClick={save} disabled={saving} className="btn-primary mt-4 w-full">
        {saving ? "Saving…" : "Log measurement"}
      </button>

      <div className="mt-6 flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between rounded-xl border px-4 py-3" data-no-vitality style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
            <span className="mono text-[0.72rem] text-muted">
              {new Date(r.measured_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="mono text-[0.8rem] tabular-nums text-muted-strong">
              {r.weight_kg != null ? `${Math.round(kgToDisplay(r.weight_kg, unit))} ${unit}` : "—"}
              {r.body_fat_percent != null ? ` · ${r.body_fat_percent}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
