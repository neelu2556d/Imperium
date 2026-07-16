"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Droplets, Dumbbell, TrendingUp } from "lucide-react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import { GearIcon } from "@/components/train/icons";
import { useOwner } from "@/lib/useOwner";
import { formatTime, formatToday, getGreeting } from "@/lib/home/datetime";
import {
  fetchTodayTrainingDay,
  fetchTrainSparkline,
  getDisplayName,
  type TodayTrainingDay,
} from "@/lib/supabase/dashboard";

export default function HomeDashboard() {
  const isOwner = useOwner();

  const [name, setName] = useState<string | null>(null);
  const [today, setToday] = useState<TodayTrainingDay | null>(null);
  const [volumes, setVolumes] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDisplayName(),
      fetchTodayTrainingDay(),
      fetchTrainSparkline(),
    ]).then(([name, today, volumes]) => {
      if (cancelled) return;
      setName(name);
      setToday(today);
      setVolumes(volumes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wall clock for the greeting. Seeded on first render (SSR uses the server's
  // timezone; the client corrects on hydration — hence suppressHydrationWarning
  // below) and ticked every 60s.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const splitName = today
    ? today.isRest
      ? "REST"
      : today.name.toUpperCase()
    : null;

  return (
    <div className="w-full px-5 pb-10 pt-8 md:px-8 lg:px-12 lg:pt-10">
      {/* ---------- greeting ---------- */}
      <header
        className="flex items-center"
        style={{ gap: 16, marginBottom: 24 }}
      >
        <ImperiumGem size={64} showChevron={false} style={{ flexShrink: 0 }} />
        <div className="min-w-0">
          <h1
            className="serif-italic"
            data-no-vitality
            suppressHydrationWarning
            style={{ fontSize: 32, lineHeight: 1.15, color: "#fff" }}
          >
            {getGreeting(now.getHours())},{" "}
            <span style={{ color: "var(--accent)" }}>{name ?? "friend"}</span>
          </h1>
          <p
            suppressHydrationWarning
            style={{
              marginTop: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {formatToday(now)} · {formatTime(now)}
          </p>
        </div>

        <Link
          href="/settings"
          data-no-vitality
          aria-label="Settings"
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-mint hover:text-fg"
        >
          <GearIcon size={17} />
        </Link>
      </header>

      {/* ---------- bento grid ---------- */}
      <div className={`bento-grid${isOwner ? " has-business" : ""}`}>
        <Card
          area="bento-train"
          href="/train"
          index="01"
          label="Train"
          ariaLabel="Open Train"
          icon={<Dumbbell size={16} />}
          sub={splitName}
        >
          <TrainChart volumes={volumes} />
        </Card>

        <Card
          area="bento-vitals"
          href="/vitals"
          index="02"
          label="Vitals"
          ariaLabel="Open Vitals"
          icon={<Activity size={16} />}
        >
          <VitalsChart />
        </Card>

        <ImperiumCard />

        <Card
          area="bento-fuel"
          href="/fuel"
          index="04"
          label="Fuel"
          ariaLabel="Open Fuel"
          icon={<Droplets size={16} />}
        >
          <FuelChart />
        </Card>

        {isOwner && (
          <Card
            area="bento-business"
            href="/business"
            index="05"
            label="Business"
            ariaLabel="Open Business"
            icon={<TrendingUp size={16} color="#F59E0B" />}
          >
            <BusinessChart />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ========================================================================
   Card shell — shared chrome (index · icon · sub-label · label · arrow)
   around an absolute chart layer. The whole card navigates on tap.
   ======================================================================== */

interface CardProps {
  /** Grid-placement class, e.g. "bento-train". */
  area: string;
  href: string;
  index: string;
  label: string;
  ariaLabel: string;
  icon?: ReactNode;
  /** Accent kicker above the label (Train's split day). */
  sub?: string | null;
  children?: ReactNode;
}

function Card({
  area,
  href,
  index,
  label,
  ariaLabel,
  icon,
  sub,
  children,
}: CardProps) {
  const router = useRouter();
  const open = () => router.push(href);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`bento-card ${area}`}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {children}
      <span className="bento-index">{index}</span>
      {icon && (
        <span className="bento-icon" aria-hidden>
          {icon}
        </span>
      )}
      {sub && <span className="bento-sub">{sub}</span>}
      <span className="bento-label">{label}</span>
      <span className="bento-arrow" aria-hidden>
        →
      </span>
    </div>
  );
}

/* ========================================================================
   03 — Imperium centrepiece: circuit traces framing the gem.
   Shares the card shell but none of the data-card chrome (no icon/arrow;
   its label is centred with the gem rather than bottom-left).
   ======================================================================== */

const TRACES = [
  "M 0,22 L 32,22 L 32,0",
  "M 100,30 L 72,30 L 72,8",
  "M 0,74 L 26,74 L 26,100",
  "M 100,70 L 70,70 L 70,92",
  "M 55,0 L 55,14 L 90,14",
];

function ImperiumCard() {
  const router = useRouter();
  const open = () => router.push("/mentor");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open Imperium, your AI mentor"
      className="bento-card bento-imperium"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <svg
        className="bento-traces"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {TRACES.map((d) => (
          <path
            key={d}
            d={d}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span className="bento-index">03</span>
      <div className="bento-imperium-inner">
        <div className="bento-gem-box">
          <ImperiumGem size={56} showChevron={false} />
        </div>
        <p className="bento-imperium-name" data-no-vitality>
          Imperium
        </p>
        <span className="bento-imperium-kicker">YOUR AI MENTOR</span>
      </div>
    </div>
  );
}

/* ========================================================================
   Charts — decorative SVG layers. Paths stretch to fill the chart area
   (preserveAspectRatio="none") with non-scaling strokes so line weights
   stay at their specified px. Endpoint dots are HTML, not <circle>: the
   non-uniform stretch would squash a circle into an ellipse on narrow
   cards, while a percent-positioned dot stays round on the same point.
   ======================================================================== */

function ChartDot({
  leftPct,
  topPct,
  color,
  glow,
}: {
  leftPct: number;
  topPct: number;
  color: string;
  glow: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: 10,
        height: 10,
        marginLeft: -5,
        marginTop: -5,
        borderRadius: "50%",
        background: color,
        filter: `drop-shadow(0 0 ${glow})`,
      }}
    />
  );
}

/** Fallback y-values (already in viewBox coords) — a gently rising curve. */
const TRAIN_PLACEHOLDER_YS = [75, 70, 65, 58, 52, 45, 30];

/** Session volumes → y-coords in [10, 90]; higher volume sits higher up. */
function trainYs(volumes: number[]): number[] {
  if (volumes.length < 2) return TRAIN_PLACEHOLDER_YS;
  const min = Math.min(...volumes);
  const max = Math.max(...volumes);
  if (max === min) return volumes.map(() => 50);
  return volumes.map((v) => 90 - ((v - min) / (max - min)) * 80);
}

/** One smooth cubic-bezier path through the points (Catmull-Rom tangents). */
function smoothPath(xs: number[], ys: number[]): string {
  const pt = (i: number): [number, number] => {
    const j = Math.max(0, Math.min(xs.length - 1, i));
    return [xs[j], ys[j]];
  };
  let d = `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const [x0, y0] = pt(i - 1);
    const [x1, y1] = pt(i);
    const [x2, y2] = pt(i + 1);
    const [x3, y3] = pt(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(
      1,
    )} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d;
}

function TrainChart({ volumes }: { volumes: number[] }) {
  const ys = trainYs(volumes);
  const n = ys.length;
  // 10-unit inset each side keeps the endpoint dot inside the clipped area.
  const xs = ys.map((_, i) => 10 + (i * 480) / (n - 1));

  return (
    <div className="bento-chart">
      <svg viewBox="0 0 500 100" preserveAspectRatio="none" aria-hidden>
        <path
          d={smoothPath(xs, ys)}
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <ChartDot
        leftPct={(xs[n - 1] / 500) * 100}
        topPct={ys[n - 1]}
        color="#fff"
        glow="4px white"
      />
    </div>
  );
}

function VitalsChart() {
  return (
    <div className="bento-chart">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden>
        <path
          d="M 0,35 L 55,35 L 68,35 L 78,8 L 88,60 L 98,30 L 110,35 L 300,35"
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* x=240, y=35 of the 300×70 viewBox */}
      <ChartDot
        leftPct={80}
        topPct={50}
        color="var(--accent)"
        glow="5px var(--accent)"
      />
    </div>
  );
}

function FuelChart() {
  return (
    <div className="bento-chart">
      <svg viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden>
        <path
          d="M 0,45 C 25,20 50,70 75,45 C 100,20 125,70 150,45 C 175,20 200,70 225,45"
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill="none"
          opacity={0.9}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 0,75 C 25,55 50,95 75,75 C 100,55 125,95 150,75 C 175,55 200,95 225,75"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* on wave 1 near the right end — the x=150, y=45 node of the curve */}
      <ChartDot
        leftPct={75}
        topPct={37.5}
        color="var(--accent)"
        glow="5px var(--accent)"
      />
    </div>
  );
}

const CANDLES = [
  { x: 40, wickTop: 20, wickBottom: 55, bodyY: 45, bodyH: 24 },
  { x: 90, wickTop: 10, wickBottom: 50, bodyY: 18, bodyH: 28 },
  { x: 150, wickTop: 25, wickBottom: 60, bodyY: 32, bodyH: 22 },
  { x: 200, wickTop: 5, wickBottom: 45, bodyY: 10, bodyH: 30 },
];

function BusinessChart() {
  return (
    <div className="bento-chart">
      <svg viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden>
        {CANDLES.map(({ x, wickTop, wickBottom, bodyY, bodyH }) => (
          <g key={x}>
            <line
              x1={x}
              y1={wickTop}
              x2={x}
              y2={wickBottom}
              stroke="#F59E0B"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect x={x - 7} y={bodyY} width={14} height={bodyH} rx={4} fill="#F59E0B" />
          </g>
        ))}
      </svg>
    </div>
  );
}
