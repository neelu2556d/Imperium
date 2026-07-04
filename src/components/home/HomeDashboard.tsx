"use client";

import { useEffect, useState, type CSSProperties } from "react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import BentoCard from "@/components/home/BentoCard";
import Sparkline from "@/components/home/Sparkline";
import MacroRing from "@/components/home/MacroRing";
import CircuitPattern from "@/components/home/CircuitPattern";
import {
  DumbbellIcon,
  FlameIcon,
  WaterDropIcon,
} from "@/components/home/icons";
import { formatToday, getGreeting } from "@/lib/home/datetime";
import {
  fetchFuelToday,
  fetchSleepSeries,
  fetchTodayTrainingDay,
  fetchTrainSparkline,
  fetchWaterToday,
  getDisplayName,
  type FuelData,
  type SleepData,
  type TodayTrainingDay,
} from "@/lib/supabase/dashboard";

interface DashboardData {
  name: string | null;
  today: TodayTrainingDay | null;
  volumes: number[];
  sleep: SleepData;
  water: number | null;
  fuel: FuelData;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData };

const AMBER = "var(--color-amber)";
const MINT = "var(--color-mint)";

export default function HomeDashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Clock-derived strings are computed in render from the local `new Date()`.
  // On the server this uses the server's timezone; the client corrects it on
  // hydration, so both elements are marked suppressHydrationWarning.
  const now = new Date();
  const greetingLead = getGreeting(now.getHours());
  const dateStr = formatToday(now);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getDisplayName(),
      fetchTodayTrainingDay(),
      fetchTrainSparkline(),
      fetchSleepSeries(),
      fetchWaterToday(),
      fetchFuelToday(),
    ]).then(([name, today, volumes, sleep, water, fuel]) => {
      if (cancelled) return;
      setState({
        status: "ready",
        data: { name, today, volumes, sleep, water, fuel },
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = state.status === "loading";
  const data = state.status === "ready" ? state.data : null;

  // ----- greeting -----
  const name = data?.name ?? null;

  // ----- card sub-labels / summaries -----
  const trainSub = data?.today
    ? data.today.isRest
      ? "REST DAY"
      : `${data.today.name.toUpperCase()} DAY`
    : "SET YOUR SPLIT";

  const sleepLatest = data?.sleep.latest ?? null;
  const water = data?.water ?? null;

  const fuel = data?.fuel;
  const fuelKcal = fuel?.hasData
    ? `${Math.round(fuel.calories)} KCAL`
    : "LOG A MEAL";

  return (
    <div className="mx-auto w-full max-w-[390px] px-5 pb-8 pt-10">
      {/* ---------- greeting ---------- */}
      <header className="mb-7 flex items-center gap-4">
        <ImperiumGem size={64} showChevron={false} style={{ flexShrink: 0 }} />
        <div className="min-w-0">
          <h1
            className="serif-italic text-2xl leading-tight"
            data-no-vitality
            suppressHydrationWarning
          >
            {greetingLead},{" "}
            <span style={{ color: "#6EE7B7" }}>{name ?? "friend"}</span>
          </h1>
          <p
            className="mono mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted"
            suppressHydrationWarning
          >
            {dateStr}
          </p>
        </div>
      </header>

      {/* ---------- bento grid ---------- */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* 01 — TRAIN */}
        <BentoCard
          index="01"
          icon={<DumbbellIcon size={18} />}
          label="Train"
          subLabel={<span style={{ color: MINT }}>{trainSub}</span>}
          href="/train"
          ariaLabel="Open Train"
          summary={
            data?.today
              ? data.today.isRest
                ? "Rest day — recovery is training too."
                : `Today: ${data.today.name}. Last 7 sessions' volume.`
              : "No split yet — tap to set one up."
          }
          style={cardStyle(140)}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <Sparkline values={data?.volumes ?? []} color={MINT} />
          )}
        </BentoCard>

        {/* 02 — VITALS */}
        <BentoCard
          index="02"
          icon={<WaterDropIcon size={18} />}
          label="Vitals"
          subLabel={<span className="text-muted-strong">SLEEP · H₂O</span>}
          href="/vitals"
          ariaLabel="Open Vitals"
          summary={
            sleepLatest != null
              ? `${sleepLatest.toFixed(1)}h sleep last night.`
              : "No vitals logged yet."
          }
          style={cardStyle(140)}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <div className="flex w-full flex-col gap-2">
              <Sparkline
                values={data?.sleep.series ?? []}
                color={data?.sleep.belowGoal ? AMBER : "rgba(255,255,255,0.75)"}
                glowColor={
                  data?.sleep.belowGoal
                    ? "rgba(245,158,11,0.45)"
                    : "rgba(255,255,255,0.4)"
                }
                width={100}
                height={34}
              />
              <p className="mono text-[0.62rem] text-muted">
                {sleepLatest != null ? `${sleepLatest.toFixed(1)}h` : "—"}
                {" · "}
                {water != null ? `${water.toFixed(1)}L` : "—"}
              </p>
            </div>
          )}
        </BentoCard>

        {/* 03 — IMPERIUM (centerpiece) */}
        <div style={{ gridColumn: "1 / -1" }}>
          <BentoCard
            index="03"
            icon={<span />}
            label="Imperium"
            subLabel={<span style={{ color: MINT }}>AI MENTOR</span>}
            href="/imperium"
            ariaLabel="Open Imperium AI mentor"
            summary="Your AI mentor — ask anything about your training."
            style={{
              minHeight: 200,
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            }}
          >
            <CircuitPattern className="pointer-events-none" />
            <div className="relative z-[1] flex w-full flex-col items-center justify-center text-center">
              <ImperiumGem size={56} showChevron={false} />
              <p className="serif-italic mt-3 text-2xl text-fg" data-no-vitality>
                Imperium
              </p>
              <p className="mono mt-1 text-[0.62rem] uppercase tracking-[0.2em] vt-mint">
                Your AI mentor
              </p>
            </div>
          </BentoCard>
        </div>

        {/* 04 — FUEL */}
        <div style={{ gridColumn: "1 / -1" }}>
          <BentoCard
            index="04"
            icon={<FlameIcon size={18} />}
            label="Fuel"
            subLabel={<span style={{ color: MINT }}>{fuelKcal}</span>}
            href="/fuel"
            ariaLabel="Open Fuel"
            summary={
              fuel?.hasData
                ? `${Math.round(fuel.calories)} kcal logged today.`
                : "Nothing logged today — tap to add a meal."
            }
            style={cardStyle(118)}
          >
            {loading ? (
              <Skeleton />
            ) : (
              <div className="flex w-full items-center gap-4">
                <MacroRing
                  calories={fuel?.calories ?? 0}
                  goalCalories={fuel?.goalCalories ?? 2200}
                  size={60}
                />
                <div className="flex flex-col gap-0.5 text-[0.72rem] leading-tight">
                  <span style={{ color: MINT }}>
                    {Math.round(fuel?.protein ?? 0)}g protein
                  </span>
                  <span style={{ color: AMBER }}>
                    {Math.round(fuel?.carbs ?? 0)}g carbs
                  </span>
                  <span className="text-muted">
                    {Math.round(fuel?.fat ?? 0)}g fat
                  </span>
                </div>
              </div>
            )}
          </BentoCard>
        </div>
      </div>
    </div>
  );
}

function cardStyle(minHeight: number): CSSProperties {
  return { minHeight };
}

/** Pulsing mint shimmer placeholder for a card body while data loads. */
function Skeleton() {
  return <div className="home-skeleton h-8 w-full rounded-md" />;
}
