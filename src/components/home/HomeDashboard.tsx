"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import VitalityTile from "@/components/home/VitalityTile";
import WireArt from "@/components/home/tileart/WireArt";
import RingArt from "@/components/home/tileart/RingArt";
import BarsArt from "@/components/home/tileart/BarsArt";
import MotesArt from "@/components/home/tileart/MotesArt";
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

  const data = state.status === "ready" ? state.data : null;

  // ----- greeting -----
  const name = data?.name ?? null;

  // ----- per-tile data -----
  const today = data?.today ?? null;
  const volumes = data?.volumes ?? [];
  const sleep = data?.sleep ?? { series: [], latest: null, belowGoal: false };
  const sleepLatest = sleep.latest;
  const sleepProgress = sleepLatest != null ? sleepLatest / 8 : 0;
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

      {/* ---------- Vitality bento grid ---------- */}
      <div className="vee-grid">
        {/* 01 — TRAIN */}
        <VitalityTile
          area="area-train"
          variant="tile-train"
          index="01"
          glyph={<DumbbellIcon size={18} />}
          label="Train"
          stat={
            today ? (today.isRest ? "REST" : today.name.toUpperCase()) : "SET UP"
          }
          art={<WireArt values={volumes} />}
          href="/train"
          ariaLabel="Open Train"
          summary={
            today
              ? today.isRest
                ? "Rest day — recovery is training too."
                : `Today: ${today.name}. Last 7 sessions' volume.`
              : "No split yet — tap to set one up."
          }
        />

        {/* 02 — VITALS */}
        <VitalityTile
          area="area-vitals"
          variant="tile-vitals"
          index="02"
          glyph={<ActivityIcon size={18} />}
          label="Vitals"
          stat={sleepLatest != null ? sleepLatest.toFixed(1) : "—"}
          unit={sleepLatest != null ? "h sleep" : undefined}
          warn={sleep.belowGoal}
          art={<RingArt progress={sleepProgress} warn={sleep.belowGoal} />}
          href="/vitals"
          ariaLabel="Open Vitals"
          summary={
            sleepLatest != null
              ? `${sleepLatest.toFixed(1)}h sleep last night.`
              : "No vitals logged yet."
          }
        />

        {/* 03 — FUEL */}
        <VitalityTile
          area="area-fuel"
          variant="tile-fuel"
          index="03"
          glyph={<FlameIcon size={18} />}
          label="Fuel"
          stat={fuel?.hasData ? String(Math.round(fuel.calories)) : "0"}
          unit="kcal"
          art={<BarsArt values={data?.fuelSeries ?? []} />}
          href="/fuel"
          ariaLabel="Open Fuel"
          summary={
            fuel?.hasData
              ? `${Math.round(fuel.calories)} kcal logged today.`
              : "Nothing logged today — tap to add a meal."
          }
        />

        {/* 04 — IMPERIUM (brand centrepiece) */}
        <BrandTile />
      </div>
    </div>
  );
}

/**
 * The Imperium brand tile — a centred breathing gem ringed by orbiting motes,
 * opening the AI mentor. Special-cased because its layout centres the gem
 * rather than using the index/stat/label chrome of the data tiles.
 */
function BrandTile() {
  const router = useRouter();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open Imperium AI mentor"
      className="vee-tile tile-brand area-brand"
      onClick={() => router.push("/mentor")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/mentor");
        }
      }}
    >
      <div className="vee-aurora" />
      <div className="vee-disc" />
      <MotesArt />
      <span className="vee-index">04</span>
      <div className="vee-brand-inner">
        <ImperiumGem size={64} showChevron={false} />
        <p className="serif-italic mt-3 text-2xl text-fg" data-no-vitality>
          Imperium
        </p>
        <span className="vee-kicker">Your AI mentor</span>
      </div>
    </div>
  );
}
