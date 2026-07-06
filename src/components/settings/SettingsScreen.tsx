"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { clearOnboardingCompleteCookie } from "@/lib/onboarding/cookie";
import {
  fetchProfileBasics,
  fetchMentorSetup,
  saveMentorSetup,
  saveProfileBasics,
} from "@/lib/supabase/profile";
import {
  DEFAULT_NUTRITION_GOALS,
  fetchNutritionGoals,
  saveNutritionGoals,
} from "@/lib/supabase/nutrition";
import {
  DEFAULT_SLEEP_GOAL,
  DEFAULT_WATER_GOAL,
  fetchSleep,
  fetchWater,
  saveSleepGoal,
  saveWaterGoal,
} from "@/lib/supabase/vitals";
import MacroDonut from "@/components/onboarding/macros/MacroDonut";
import ChoiceCard from "@/components/onboarding/training/primitives/ChoiceCard";
import Chip from "@/components/onboarding/training/primitives/Chip";

/* ------------------------------ shared bits ------------------------------ */

const LB_PER_KG = 0.45359237;
const CM_PER_IN = 2.54;

const numOrNull = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A titled panel: small-caps muted heading sitting above a raised card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mono mb-2 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted">
        {title}
      </h2>
      <div className="card-raised p-5">{children}</div>
    </section>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * A self-contained save control: runs `onSave`, then shows a transient "Saved"
 * confirmation or an inline error. Each section owns one, so saves are
 * independent — there is no page-level save.
 */
function SaveButton({
  onSave,
  disabled,
  label = "Save",
}: {
  onSave: () => Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (disabled || state === "saving") return;
    setState("saving");
    setError(null);
    try {
      await onSave();
      setState("saved");
      window.setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setState("error");
    }
  };

  return (
    <div className="mt-5 flex items-center justify-end gap-3">
      {state === "saved" && (
        <span className="text-xs" style={{ color: "var(--color-mint)" }}>
          Saved ✓
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--color-red)" }} role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        className="btn-primary"
        disabled={disabled || state === "saving"}
        onClick={handle}
        style={{ paddingInline: "1.5rem" }}
      >
        {state === "saving" ? "Saving…" : label}
      </button>
    </div>
  );
}

/** Small segmented pill for unit switching (cm/ft, kg/lb). */
function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
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

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm text-muted-strong">
      {children}
    </label>
  );
}

/* ------------------------------ 1. Profile ------------------------------ */

type HeightUnit = "cm" | "ftin";
type WeightUnit = "kg" | "lb";

function ProfileSection() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [cm, setCm] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchProfileBasics()
      .then((p) => {
        if (cancelled) return;
        setName(p.name);
        setAge(p.age != null ? String(p.age) : "");
        if (p.heightCm != null) setCm(String(round1(p.heightCm)));
        if (p.weightKg != null) setWeight(String(round1(p.weightKg)));
      })
      .catch(() => {
        /* leave blank on load failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchHeight = (next: string) => {
    const unit = next as HeightUnit;
    if (unit === heightUnit) return;
    if (unit === "ftin") {
      const cmVal = numOrNull(cm);
      if (cmVal != null) {
        const totalIn = cmVal / CM_PER_IN;
        let ft = Math.floor(totalIn / 12);
        let inch = Math.round(totalIn - ft * 12);
        if (inch === 12) {
          ft += 1;
          inch = 0;
        }
        setFeet(String(ft));
        setInches(String(inch));
      }
    } else {
      const ft = numOrNull(feet);
      const inch = numOrNull(inches) ?? 0;
      if (ft != null) setCm(String(round1((ft * 12 + inch) * CM_PER_IN)));
    }
    setHeightUnit(unit);
  };

  const switchWeight = (next: string) => {
    const unit = next as WeightUnit;
    if (unit === weightUnit) return;
    const w = numOrNull(weight);
    if (w != null) {
      if (unit === "lb") setWeight(String(round1(w / LB_PER_KG)));
      else setWeight(String(round1(w * LB_PER_KG)));
    }
    setWeightUnit(unit);
  };

  const heightCm =
    heightUnit === "cm"
      ? numOrNull(cm)
      : numOrNull(feet) != null
        ? round1((numOrNull(feet)! * 12 + (numOrNull(inches) ?? 0)) * CM_PER_IN)
        : null;
  const weightKg =
    numOrNull(weight) != null
      ? weightUnit === "kg"
        ? numOrNull(weight)!
        : round1(numOrNull(weight)! * LB_PER_KG)
      : null;

  const valid =
    name.trim() !== "" &&
    numOrNull(age) != null &&
    numOrNull(age)! > 0 &&
    heightCm != null &&
    heightCm > 0 &&
    weightKg != null &&
    weightKg > 0;

  const save = () =>
    saveProfileBasics({
      name: name.trim(),
      age: numOrNull(age)!,
      heightCm: heightCm!,
      weightKg: weightKg!,
    });

  return (
    <Section title="Profile">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="set-name">Name</FieldLabel>
          <input
            id="set-name"
            type="text"
            value={name}
            placeholder="Your name"
            className="w-full"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel htmlFor="set-age">Age</FieldLabel>
          <input
            id="set-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={age}
            placeholder="Years"
            className="w-full"
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor={heightUnit === "cm" ? "set-cm" : "set-feet"}
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
              onChange={switchHeight}
            />
          </div>
          {heightUnit === "cm" ? (
            <input
              id="set-cm"
              type="number"
              inputMode="decimal"
              min={1}
              value={cm}
              placeholder="cm"
              className="w-full"
              onChange={(e) => setCm(e.target.value)}
            />
          ) : (
            <div className="flex gap-3">
              <input
                id="set-feet"
                type="number"
                inputMode="numeric"
                min={1}
                value={feet}
                placeholder="ft"
                className="w-full"
                onChange={(e) => setFeet(e.target.value)}
              />
              <input
                id="set-inches"
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
            <label htmlFor="set-weight" className="text-sm text-muted-strong">
              Weight
            </label>
            <UnitToggle
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
              value={weightUnit}
              onChange={switchWeight}
            />
          </div>
          <input
            id="set-weight"
            type="number"
            inputMode="decimal"
            min={1}
            value={weight}
            placeholder={weightUnit}
            className="w-full"
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      <SaveButton onSave={save} disabled={!valid} />
    </Section>
  );
}

/* --------------------------- 2. Nutrition Goals --------------------------- */

const MACRO_FIELDS: { key: "calories" | "protein" | "fat" | "carbs"; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
];

const toNum = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

function NutritionSection() {
  const [values, setValues] = useState<Record<string, string>>({
    calories: String(DEFAULT_NUTRITION_GOALS.calories),
    protein: String(DEFAULT_NUTRITION_GOALS.protein_g),
    fat: String(DEFAULT_NUTRITION_GOALS.fat_g),
    carbs: String(DEFAULT_NUTRITION_GOALS.carbs_g),
  });

  useEffect(() => {
    let cancelled = false;
    fetchNutritionGoals()
      .then((g) => {
        if (cancelled || !g) return;
        setValues({
          calories: String(g.calories),
          protein: String(g.protein_g),
          fat: String(g.fat_g),
          carbs: String(g.carbs_g),
        });
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const valid = MACRO_FIELDS.every((f) => {
    const raw = values[f.key].trim();
    return raw !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0;
  });

  const save = () =>
    saveNutritionGoals({
      calories: toNum(values.calories),
      protein_g: toNum(values.protein),
      fat_g: toNum(values.fat),
      carbs_g: toNum(values.carbs),
    });

  return (
    <Section title="Nutrition Goals">
      <div className="grid grid-cols-2 gap-4">
        {MACRO_FIELDS.map((f) => (
          <div key={f.key}>
            <FieldLabel htmlFor={`set-macro-${f.key}`}>{f.label}</FieldLabel>
            <div className="relative">
              <input
                id={`set-macro-${f.key}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={values[f.key]}
                className="w-full pr-12"
                onChange={(e) => setField(f.key, e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                {f.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <MacroDonut
          calories={toNum(values.calories)}
          proteinG={toNum(values.protein)}
          carbsG={toNum(values.carbs)}
          fatG={toNum(values.fat)}
        />
      </div>

      <SaveButton onSave={save} disabled={!valid} />
    </Section>
  );
}

/* ---------------------------- 3. Vitals Goals ---------------------------- */

function VitalsSection() {
  const [water, setWater] = useState(String(DEFAULT_WATER_GOAL));
  const [sleep, setSleep] = useState(String(DEFAULT_SLEEP_GOAL));

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchWater(), fetchSleep()])
      .then(([w, s]) => {
        if (cancelled) return;
        setWater(String(w.goal));
        setSleep(String(s.goal));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const waterVal = numOrNull(water);
  const sleepVal = numOrNull(sleep);
  const valid =
    waterVal != null && waterVal > 0 && sleepVal != null && sleepVal > 0;

  const save = async () => {
    await Promise.all([saveWaterGoal(waterVal!), saveSleepGoal(sleepVal!)]);
  };

  return (
    <Section title="Vitals Goals">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="set-water">Water goal</FieldLabel>
          <div className="relative">
            <input
              id="set-water"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={water}
              className="w-full pr-9"
              onChange={(e) => setWater(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              L
            </span>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="set-sleep">Sleep goal</FieldLabel>
          <div className="relative">
            <input
              id="set-sleep"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.05}
              value={sleep}
              className="w-full pr-12"
              onChange={(e) => setSleep(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              hrs
            </span>
          </div>
        </div>
      </div>

      <SaveButton onSave={save} disabled={!valid} />
    </Section>
  );
}

/* ------------------------------ 4. Training ------------------------------ */

function NavRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      data-no-vitality
      className="flex items-center justify-between rounded-lg border border-border px-4 py-3.5 text-sm text-muted-strong transition-colors hover:border-mint hover:text-fg"
      style={{ background: "var(--color-card)" }}
    >
      <span>{children}</span>
      <span aria-hidden style={{ color: "var(--color-mint)" }}>
        →
      </span>
    </Link>
  );
}

function TrainingSection() {
  return (
    <Section title="Training">
      <div className="flex flex-col gap-3">
        <NavRow href="/onboarding/customize-days">Adjust your training</NavRow>
        <NavRow href="/onboarding/training/1">Redo onboarding quiz</NavRow>
      </div>
    </Section>
  );
}

/* ------------------------------- 5. Mentor ------------------------------- */

const TONES: { value: string; subtitle: string }[] = [
  { value: "Blunt", subtitle: "no fluff, just what you need to hear" },
  { value: "Encouraging", subtitle: "in your corner, always" },
  { value: "Clinical", subtitle: "data-first, emotion-last" },
];

const ALL = "All of the above";
const FOCUSES = [
  "Training performance",
  "Recovery & sleep",
  "Nutrition & macros",
  "Mental focus",
  "Progressive overload",
];

function MentorSection() {
  const [tone, setTone] = useState<string | undefined>(undefined);
  const [focus, setFocus] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMentorSetup()
      .then((setup) => {
        if (cancelled) return;
        if (setup.tone) setTone(setup.tone);
        if (setup.focus.length) setFocus(setup.focus);
      })
      .catch(() => {
        /* leave unset */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allSelected = FOCUSES.every((f) => focus.includes(f));

  const toggleFocus = (value: string) => {
    if (value === ALL) {
      setFocus(allSelected ? [] : [...FOCUSES]);
      return;
    }
    setFocus((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const save = () => saveMentorSetup(tone!, focus);

  return (
    <Section title="Mentor">
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-strong">Tone</h3>
        <div className="grid grid-cols-3 gap-3">
          {TONES.map((t) => (
            <ChoiceCard
              key={t.value}
              title={t.value}
              subtitle={t.subtitle}
              checkBadge
              selected={tone === t.value}
              onSelect={() => setTone(t.value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-muted-strong">Focus areas</h3>
        <div className="flex flex-wrap gap-2">
          {FOCUSES.map((f) => (
            <Chip
              key={f}
              label={f}
              checkOnSelect
              selected={focus.includes(f)}
              onToggle={() => toggleFocus(f)}
            />
          ))}
          <Chip
            label={ALL}
            checkOnSelect
            selected={allSelected}
            onToggle={() => toggleFocus(ALL)}
          />
        </div>
      </div>

      <SaveButton onSave={save} disabled={!tone} />
    </Section>
  );
}

/* ------------------------------- 6. Account ------------------------------ */

function AccountSection() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      /* even if the network call fails, drop the local session below */
    }
    clearOnboardingCompleteCookie();
    router.replace("/welcome");
  };

  return (
    <Section title="Account">
      <button
        type="button"
        data-no-vitality
        onClick={signOut}
        disabled={signingOut}
        className="w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ borderColor: "var(--color-red)", color: "var(--color-red)" }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </Section>
  );
}

/* -------------------------------- screen -------------------------------- */

export default function SettingsScreen() {
  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-28 pt-8">
      <header className="mb-7 flex items-center gap-3">
        <Link
          href="/train"
          aria-label="Back to training"
          data-no-vitality
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
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
        <h1 className="serif-italic text-3xl leading-tight" data-no-vitality>
          Settings
        </h1>
      </header>

      <ProfileSection />
      <NutritionSection />
      <VitalsSection />
      <TrainingSection />
      <MentorSection />
      <AccountSection />
    </div>
  );
}
