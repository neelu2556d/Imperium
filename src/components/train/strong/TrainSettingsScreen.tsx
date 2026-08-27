"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushToast } from "@/lib/toast";
import {
  DEFAULT_TRAIN_SETTINGS,
  getTrainSettings,
  saveTrainSettings,
  type TrainSettings,
  type WeightUnit,
} from "@/lib/train/settings";

/** /train/settings — weight unit, rest-timer length, default sets/reps. */
export default function TrainSettingsScreen() {
  const router = useRouter();
  const [s, setS] = useState<TrainSettings>(DEFAULT_TRAIN_SETTINGS);

  useEffect(() => {
    const id = requestAnimationFrame(() => setS(getTrainSettings()));
    return () => cancelAnimationFrame(id);
  }, []);

  const update = (patch: Partial<TrainSettings>) => {
    const next = saveTrainSettings(patch);
    setS(next);
  };

  const numField = (label: string, key: "restSeconds" | "defaultSets" | "defaultReps", suffix: string) => (
    <label className="flex items-center justify-between rounded-2xl border p-4" data-no-vitality style={cardStyle}>
      <span className="text-[0.88rem] text-muted-strong">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={s[key]}
          onChange={(e) => update({ [key]: Number(e.target.value) || 0 } as Partial<TrainSettings>)}
          className="mono tabular-nums w-20 text-right"
          data-no-vitality
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.4rem 0.5rem", color: "var(--color-fg)" }}
        />
        <span className="text-[0.72rem] text-muted">{suffix}</span>
      </span>
    </label>
  );

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
          Train settings
        </h1>
      </header>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl border p-4" data-no-vitality style={cardStyle}>
          <span className="text-[0.88rem] text-muted-strong">Weight unit</span>
          <div className="flex gap-1.5">
            {(["kg", "lbs"] as WeightUnit[]).map((u) => {
              const active = s.unit === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => update({ unit: u })}
                  data-no-vitality
                  className="rounded-full px-4 py-1.5 text-[0.78rem] font-medium"
                  style={{
                    border: active ? "1px solid var(--accent)" : "1px solid var(--color-border)",
                    background: active ? "var(--accent)" : "var(--color-card)",
                    color: active ? "var(--accent-ink)" : "var(--color-muted-strong)",
                  }}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>

        {numField("Rest timer", "restSeconds", "sec")}
        {numField("Default sets", "defaultSets", "sets")}
        {numField("Default reps", "defaultReps", "reps")}
      </div>

      <button
        type="button"
        onClick={() => {
          pushToast("Settings saved");
          router.push("/train");
        }}
        className="btn-primary mt-6 w-full"
      >
        Done
      </button>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-card-elevated)",
};
