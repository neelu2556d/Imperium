"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import { saveProfileBasics } from "@/lib/supabase/profile";

type HeightUnit = "cm" | "ftin";
type WeightUnit = "kg" | "lb";

const LB_PER_KG = 0.45359237;
const CM_PER_IN = 2.54;

/** Which fields are currently empty and should get the mint nudge. */
type FieldId = "name" | "age" | "cm" | "feet" | "weight";

export default function AboutStep() {
  const onboarding = useOnboarding();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [cm, setCm] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weight, setWeight] = useState("");

  const [pulse, setPulse] = useState<Set<FieldId>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (value: string): number | null => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Re-arm the CSS animation even when the same fields were already pulsing:
  // clear the set, then re-apply after two frames so the keyframes restart.
  const triggerPulse = useCallback((fields: FieldId[]) => {
    setPulse(new Set());
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setPulse(new Set(fields)))
    );
  }, []);

  const clearPulse = (field: FieldId) =>
    setPulse((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

  const handleContinue = async () => {
    if (onboarding.status !== "ready" || submitting) return;
    setError(null);

    const missing: FieldId[] = [];
    if (name.trim() === "") missing.push("name");
    if (num(age) === null) missing.push("age");
    if (heightUnit === "cm") {
      if (num(cm) === null) missing.push("cm");
    } else if (num(feet) === null) {
      // Inches are optional (0 is valid); feet anchors a real height.
      missing.push("feet");
    }
    if (num(weight) === null) missing.push("weight");

    if (missing.length > 0) {
      triggerPulse(missing);
      return;
    }

    const heightCm =
      heightUnit === "cm"
        ? num(cm)!
        : Math.round((num(feet)! * 12 + (num(inches) ?? 0)) * CM_PER_IN * 10) /
          10;
    const weightKg =
      weightUnit === "kg"
        ? num(weight)!
        : Math.round(num(weight)! * LB_PER_KG * 100) / 100;

    setSubmitting(true);
    try {
      await saveProfileBasics({
        name: name.trim(),
        age: num(age)!,
        heightCm,
        weightKg,
      });
      // Marks 'about' completed, advances current_step, and navigates to
      // /onboarding/setup.
      await onboarding.completeStep("about");
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error ? err.message : "Couldn't save. Please try again."
      );
    }
  };

  const fieldClass = (field: FieldId) =>
    pulse.has(field) ? "vt-field-pulse" : "";
  const invalid = (field: FieldId) => (pulse.has(field) ? true : undefined);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link
        href="/welcome"
        aria-label="Go back"
        data-no-vitality
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-fg/70 transition-colors hover:text-fg"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <p
        className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
        data-no-vitality
      >
        About you · Step 1 of 4
      </p>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={25}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          data-no-vitality
          className="h-full rounded-full"
          style={{ width: "25%", background: "var(--color-mint)" }}
        />
      </div>

      <h1 className="mt-8 text-3xl">Let&rsquo;s start with the basics.</h1>

      <form
        className="mt-8 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleContinue();
        }}
      >
        <div>
          <label htmlFor="about-name" className="mb-2 block text-sm text-muted-strong">
            What should I call you?
          </label>
          <input
            id="about-name"
            type="text"
            value={name}
            placeholder="Your name"
            autoComplete="given-name"
            aria-invalid={invalid("name")}
            className={`w-full ${fieldClass("name")}`}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim() !== "") clearPulse("name");
            }}
          />
        </div>

        <div>
          <label htmlFor="about-age" className="mb-2 block text-sm text-muted-strong">
            How old are you?
          </label>
          <input
            id="about-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={age}
            placeholder="Years"
            aria-invalid={invalid("age")}
            className={`w-full ${fieldClass("age")}`}
            onChange={(e) => {
              setAge(e.target.value);
              if (e.target.value.trim() !== "") clearPulse("age");
            }}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor={heightUnit === "cm" ? "about-cm" : "about-feet"}
              className="text-sm text-muted-strong"
            >
              Height
            </label>
            <UnitToggle
              options={[
                { value: "cm", label: "cm" },
                { value: "ftin", label: "ft/in" },
              ]}
              value={heightUnit}
              onChange={(v) => setHeightUnit(v as HeightUnit)}
            />
          </div>

          {heightUnit === "cm" ? (
            <input
              id="about-cm"
              type="number"
              inputMode="decimal"
              min={1}
              value={cm}
              placeholder="cm"
              aria-invalid={invalid("cm")}
              className={`w-full ${fieldClass("cm")}`}
              onChange={(e) => {
                setCm(e.target.value);
                if (e.target.value.trim() !== "") clearPulse("cm");
              }}
            />
          ) : (
            <div className="flex gap-3">
              <input
                id="about-feet"
                type="number"
                inputMode="numeric"
                min={1}
                value={feet}
                placeholder="ft"
                aria-invalid={invalid("feet")}
                className={`w-full ${fieldClass("feet")}`}
                onChange={(e) => {
                  setFeet(e.target.value);
                  if (e.target.value.trim() !== "") clearPulse("feet");
                }}
              />
              <input
                id="about-inches"
                type="number"
                inputMode="numeric"
                min={0}
                max={11}
                value={inches}
                placeholder="in"
                className="w-full"
                onChange={(e) => setInches(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="about-weight" className="text-sm text-muted-strong">
              Weight
            </label>
            <UnitToggle
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
              value={weightUnit}
              onChange={(v) => setWeightUnit(v as WeightUnit)}
            />
          </div>
          <input
            id="about-weight"
            type="number"
            inputMode="decimal"
            min={1}
            value={weight}
            placeholder={weightUnit}
            aria-invalid={invalid("weight")}
            className={`w-full ${fieldClass("weight")}`}
            onChange={(e) => {
              setWeight(e.target.value);
              if (e.target.value.trim() !== "") clearPulse("weight");
            }}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--color-red)" }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary mt-2 w-full"
          disabled={onboarding.status !== "ready" || submitting}
        >
          {submitting ? "Saving…" : "continue →"}
        </button>
      </form>
    </div>
  );
}

interface UnitToggleProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Small segmented pill for switching measurement units. Opts out of the global
 * button styling (data-no-vitality) so it reads as a control, not an action.
 */
function UnitToggle({ options, value, onChange }: UnitToggleProps) {
  return (
    <div
      data-no-vitality
      role="group"
      className="inline-flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-no-vitality
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? "var(--color-mint)" : "transparent",
              color: active ? "var(--color-mint-ink)" : "var(--color-muted)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
