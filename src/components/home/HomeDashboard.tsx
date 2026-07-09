"use client";

import { useEffect, useState, type CSSProperties } from "react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import BentoCard from "@/components/home/BentoCard";
import Sparkline from "@/components/home/Sparkline";
import CircuitPattern from "@/components/home/CircuitPattern";
import {
  ActivityIcon,
  DumbbellIcon,
  FlameIcon,
} from "@/components/home/icons";
import { formatTime, formatToday, getGreeting } from "@/lib/home/datetime";
import {
  fetchFuelSparkline,
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
  fuelSeries: number[];
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData };

const AMBER = "var(--color-amber)";
const MINT = "var(--color-mint)";

export default function HomeDashboard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Live wall clock. Seeded on first render (SSR uses the server's timezone; the
  // client corrects on hydration — hence suppressHydrationWarning below) and
  // ticked every second so the greeting rolls morning→afternoon→evening and the
  // time stays current without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const greetingLead = getGreeting(now.getHours());
  const dateStr = formatToday(now);
  const timeStr = formatTime(now);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getDisplayName(),
      fetchTodayTrainingDay(),
      fetchTrainSparkline(),
      fetchSleepSeries(),
      fetchWaterToday(),
      fetchFuelToday(),
      fetchFuelSparkline(),
    ]).then(([name, today, volumes, sleep, water, fuel, fuelSeries]) => {
      if (cancelled) return;
      setState({
        status: "ready",
        data: { name, today, volumes, sleep, water, fuel, fuelSeries },
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

  // ----- card summaries (revealed on long-press) -----
  const sleepLatest = data?.sleep.latest ?? null;
  const fuel = data?.fuel;

  return (
    <div className="w-full px-5 pb-10 pt-8 md:px-8 lg:px-12 lg:pt-10">
      {/* ---------- greeting ---------- */}
      <header className="mb-6 flex items-center gap-4 md:mb-8 md:gap-6">
        <ImperiumGem
          size={84}
          showChevron={false}
          style={{ flexShrink: 0 }}
        />
        <div className="min-w-0">
          <h1
            className="serif-italic text-3xl leading-tight md:text-5xl"
            data-no-vitality
            suppressHydrationWarning
          >
            {greetingLead},{" "}
            <span style={{ color: "var(--color-mint)" }}>{name ?? "friend"}</span>
          </h1>
          <p
            className="mono mt-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-muted md:text-xs"
            suppressHydrationWarning
          >
            {dateStr} · {timeStr}
          </p>
        </div>
      </header>

      {/* ---------- dashboard masonry ---------- */}
      <div className="home-grid">
        {/* 01 — TRAIN (wide banner) */}
        <BentoCard
          className="area-train"
          index="01"
          icon={<DumbbellIcon size={18} />}
          label="Train"
          feature
          href="/train"
          ariaLabel="Open Train"
          summary={
            data?.today
              ? data.today.isRest
                ? "Rest day — recovery is training too."
                : `Today: ${data.today.name}. Last 7 sessions' volume.`
              : "No split yet — tap to set one up."
          }
          style={cardStyle(150)}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <div className="w-full">
              <Sparkline
                values={data?.volumes ?? []}
                color={MINT}
                width="100%"
                height={72}
              />
            </div>
          )}
        </BentoCard>

        {/* 02 — VITALS */}
        <BentoCard
          className="area-vitals"
          index="04"
          icon={<ActivityIcon size={18} />}
          label="Vitals"
          feature
          href="/vitals"
          ariaLabel="Open Vitals"
          summary={
            sleepLatest != null
              ? `${sleepLatest.toFixed(1)}h sleep last night.`
              : "No vitals logged yet."
          }
          style={cardStyle(150)}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <div className="w-full">
              <Sparkline
                values={data?.sleep.series ?? []}
                color={data?.sleep.belowGoal ? AMBER : "rgba(255,255,255,0.8)"}
                glowColor={
                  data?.sleep.belowGoal
                    ? "rgba(245,158,11,0.45)"
                    : "rgba(255,255,255,0.4)"
                }
                width="100%"
                height={56}
              />
            </div>
          )}
        </BentoCard>

        {/* 06 — IMPERIUM (centrepiece) */}
        <BentoCard
          className="area-imperium"
          index="06"
          icon={<span />}
          label="Imperium"
          subLabel={<span style={{ color: MINT }}>AI MENTOR</span>}
          href="/mentor"
          ariaLabel="Open Imperium AI mentor"
          summary="Your AI mentor — ask anything about your training."
          style={{
            minHeight: 220,
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          }}
        >
          <CircuitPattern className="pointer-events-none" />
          <div className="relative z-[1] flex w-full flex-1 flex-col items-center justify-center text-center">
            <ImperiumGem size={72} showChevron={false} />
            <p
              className="serif-italic mt-4 text-3xl text-fg md:text-4xl"
              data-no-vitality
            >
              Imperium
            </p>
            <p className="mono mt-1.5 text-[0.62rem] uppercase tracking-[0.2em] vt-mint">
              Your AI mentor
            </p>
          </div>
        </BentoCard>

        {/* 02 — FUEL (right rail) */}
        <BentoCard
          className="area-fuel"
          index="02"
          icon={<FlameIcon size={18} />}
          label="Fuel"
          feature
          href="/fuel"
          ariaLabel="Open Fuel"
          summary={
            fuel?.hasData
              ? `${Math.round(fuel.calories)} kcal logged today.`
              : "Nothing logged today — tap to add a meal."
          }
          style={cardStyle(150)}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <div className="w-full">
              <Sparkline
                values={data?.fuelSeries ?? []}
                color={MINT}
                width="100%"
                height={72}
              />
            </div>
          )}
        </BentoCard>
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
