"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Droplets, Dumbbell, TrendingUp } from "lucide-react";
import ImperiumGem from "@/components/welcome/ImperiumGem";
import { GearIcon } from "@/components/train/icons";
import { useReducedMotion } from "@/lib/motion";
import { useOwner } from "@/lib/useOwner";
import { formatTime, formatToday, getGreeting } from "@/lib/home/datetime";
import { fetchTodayTrainingDay, fetchTrainSparkline } from "@/lib/supabase/dashboard";
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
            icon={<TrendingUp size={16} color="#4ade80" />}
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
      onMouseEnter={() => router.prefetch(href)}
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
   03 — Imperium centrepiece, matching the reference mentor tile: a rounded
   chip framing the (static) gem, dim circuit wires converging on it with
   accent pulses riding them, a breathing light disc behind, and the
   label/kicker pinned bottom-left under a corner scrim.
   ======================================================================== */

/** Dim always-on wires (reference tints: mint / iris / gold). The tracks run
 *  far past the 434×250 viewBox on purpose — with `slice` scaling they always
 *  reach the card edge regardless of the card's aspect ratio. */
const VEE_WIRES: Array<{ d: string; tint: string }> = [
  { d: "M216 66 V2", tint: "rgba(167,243,208,0.2)" },
  { d: "M262 96 H300 V40 H760", tint: "rgba(185,163,255,0.2)" },
  { d: "M262 140 H320 V192 H760", tint: "rgba(232,200,120,0.2)" },
  { d: "M190 158 V248", tint: "rgba(167,243,208,0.2)" },
  { d: "M170 140 H114 V192 H-326", tint: "rgba(185,163,255,0.2)" },
  { d: "M170 96 H134 V56 H-326", tint: "rgba(232,200,120,0.2)" },
];

/** The same tracks oriented outside-in, so the feed pulses run toward the chip. */
const VEE_FEEDS = [
  "M216 2 V66",
  "M760 40 H300 V96 H262",
  "M760 192 H320 V140 H262",
  "M190 248 V158",
  "M-326 192 H114 V140 H170",
  "M-326 56 H134 V96 H170",
];

function ImperiumCard() {
  const router = useRouter();
  const cardRef = useMotionPause<HTMLDivElement>();
  const open = () => router.push("/mentor");

  return (
    <div
      ref={cardRef}
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
      <div className="bento-vee-disc" aria-hidden />
      <svg
        className="bento-vee-art"
        viewBox="0 0 434 250"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {VEE_WIRES.map(({ d, tint }) => (
          <path key={d} className="bento-wire" style={{ stroke: tint }} d={d} />
        ))}
        {VEE_FEEDS.map((d, i) => (
          <path
            key={d}
            className="bento-feed"
            pathLength={100}
            d={d}
            style={{ animationDelay: `${(i * 0.7).toFixed(1)}s` }}
          />
        ))}
        <rect className="bento-chip" x={170} y={66} width={92} height={92} rx={24} />
        {/* the gem — static (no rotation), locked to the chip's centre. Inlined
            from ImperiumGem so it scales with the chip geometry. */}
        <g
          className="bento-chip-gem"
          transform="translate(216 112) scale(0.42) translate(-60 -75)"
        >
          <polygon points="60,8 22,46 60,72" fill="var(--color-mint-soft)" />
          <polygon points="60,8 98,46 60,72" fill="var(--color-mint)" />
          <polygon points="22,46 32,112 60,72" fill="var(--color-mint-deep)" />
          <polygon points="98,46 88,112 60,72" fill="var(--color-mint-hover)" />
          <polygon points="32,112 60,132 60,72" fill="var(--color-mint)" />
          <polygon points="88,112 60,132 60,72" fill="var(--color-mint-deep)" />
          <polygon
            points="60,8 22,46 98,46"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
        </g>
      </svg>
      <div className="bento-vee-scrim" aria-hidden />
      <span className="bento-index">03</span>
      <span className="bento-vee-label" data-no-vitality>
        Imperium
      </span>
      <span className="bento-vee-kicker">Your AI mentor</span>
      <span className="bento-arrow" aria-hidden>
        →
      </span>
    </div>
  );
}

/* ========================================================================
   Charts — decorative SVG layers. Paths stretch to fill the chart area
   (preserveAspectRatio="none") with non-scaling strokes so line weights
   stay at their specified px. Endpoint dots are HTML, not <circle>: the
   non-uniform stretch would squash a circle into an ellipse on narrow
   cards, while a percent-positioned dot stays round on the same point.

   Ambient motion: dots that travel a path use SMIL (<animateMotion>) —
   CSS can't follow a path — while the scrolling EKG/waves, dot pulse, gem
   pulse/spin and candle rise-ins are CSS (see the bento block in the
   globals.css motion pass). SMIL ignores both prefers-reduced-motion and
   CSS animation-play-state, so useReducedMotion gates the SMIL dots at
   render time (static dots instead) and useMotionPause stops both kinds
   of animation while a card is scrolled out of the viewport.
   ======================================================================== */

/**
 * Pauses a card's infinite animations while it is offscreen: an
 * IntersectionObserver toggles .bento-motion-paused (CSS animations pick
 * this up via animation-play-state) and pause/unpauses the SMIL timeline
 * of every svg inside the observed element.
 */
function useMotionPause<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      el.classList.toggle("bento-motion-paused", !visible);
      el.querySelectorAll("svg").forEach((svg) => {
        if (visible) svg.unpauseAnimations();
        else svg.pauseAnimations();
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/**
 * A round dot that can ride an <animateMotion> inside a stretched svg:
 * a hairline path painted only by its round cap, with a non-scaling
 * stroke, stays a screen-space circle of `size` px where a real <circle>
 * would be squashed into an ellipse by the non-uniform viewBox scale.
 * `children` is the SMIL machinery (<animateMotion>, <animate>). Pass
 * opacity 0 when an opacity <animate> with a `begin` delay fades the dot
 * in, so it stays hidden until its timeline starts.
 */
function MotionDot({
  size,
  color,
  glow,
  opacity,
  className,
  children,
}: {
  size: number;
  color: string;
  glow: string;
  opacity?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <path
      d="M 0,0 L 0.01,0.01"
      className={className}
      stroke={color}
      strokeWidth={size}
      strokeLinecap="round"
      fill="none"
      opacity={opacity}
      vectorEffect="non-scaling-stroke"
      style={{ filter: `drop-shadow(0 0 ${glow})` }}
    >
      {children}
    </path>
  );
}

/**
 * The reference dashboard's ambient "orb": a soft breathing glow with a
 * bright node core, drifting back and forth along a path. Two stacked
 * MotionDots ride identical SMIL timelines (CSS can't follow a path). The
 * default keyPoints wander the line; callers can pass a dwell-and-hop
 * pattern instead (see BusinessChart).
 */
function WanderOrb({
  pathId,
  dur = "16s",
  color = "var(--accent)",
  keyPoints = "0.08;0.9;0.35;0.72;0.08",
  keyTimes = "0;0.3;0.55;0.8;1",
}: {
  pathId: string;
  dur?: string;
  color?: string;
  keyPoints?: string;
  keyTimes?: string;
}) {
  const motion = (
    <animateMotion
      dur={dur}
      repeatCount="indefinite"
      calcMode="linear"
      keyPoints={keyPoints}
      keyTimes={keyTimes}
    >
      <mpath href={`#${pathId}`} />
    </animateMotion>
  );
  return (
    <>
      <MotionDot size={16} color={color} glow={`6px ${color}`} className="bento-orb-glow">
        {motion}
      </MotionDot>
      <MotionDot size={6.5} color="#eafff5" glow={`3px ${color}`}>
        {motion}
      </MotionDot>
    </>
  );
}

function ChartDot({
  leftPct,
  topPct,
  color,
  glow,
  className,
}: {
  leftPct: number;
  topPct: number;
  color: string;
  glow: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={className}
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

const TrainChart = memo(function TrainChart({ volumes }: { volumes: number[] }) {
  const reduced = useReducedMotion();
  const chartRef = useMotionPause<HTMLDivElement>();
  const ys = trainYs(volumes);
  const n = ys.length;
  // 10-unit inset each side keeps the orb inside the clipped area.
  const xs = ys.map((_, i) => 10 + (i * 480) / (n - 1));

  return (
    <div ref={chartRef} className="bento-chart">
      <svg viewBox="0 0 500 100" preserveAspectRatio="none" aria-hidden>
        <path
          id="train-path"
          className="bento-mot"
          d={smoothPath(xs, ys)}
          vectorEffect="non-scaling-stroke"
        />
        {/* the orb drifts along the sparkline; the line itself is static */}
        {!reduced && <WanderOrb pathId="train-path" dur="16s" />}
      </svg>
      {reduced && (
        <ChartDot
          leftPct={(xs[n - 1] / 500) * 100}
          topPct={ys[n - 1]}
          color="var(--accent)"
          glow="4px var(--accent)"
        />
      )}
    </div>
  );
});

/* Amplitude is tuned for the 2-row-tall card: the stretched
   (preserveAspectRatio="none") svg renders ~3× taller than a single row,
   so the spike is ±½ range in viewBox units to land at a sane px height. */
const EKG_PATH =
  "M 0,35 L 55,35 L 68,35 L 78,26 L 88,43.5 L 98,33.5 L 110,35 L 300,35";

const VitalsChart = memo(function VitalsChart() {
  const reduced = useReducedMotion();
  const chartRef = useMotionPause<HTMLDivElement>();

  return (
    <div ref={chartRef} className="bento-chart">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden>
        {/* static EKG trace, reference-style; the orb wanders it */}
        <path
          id="vitals-path"
          className="bento-mot"
          d={EKG_PATH}
          vectorEffect="non-scaling-stroke"
        />
        {!reduced && <WanderOrb pathId="vitals-path" dur="13s" />}
      </svg>
      {reduced && (
        <ChartDot
          leftPct={80}
          topPct={50}
          color="var(--accent)"
          glow="5px var(--accent)"
        />
      )}
    </div>
  );
}

/* Both waves span x 0→200 (one viewBox width) so a doubled copy at
   translate(200,0) tiles seamlessly. The original wave's 75-unit period is
   nudged to 200/3 ≈ 66.7 so exactly three oscillations fit the tile; the
   group scrolls one width per loop. Amplitude is tuned for the 3-row-tall
   card — the stretched (preserveAspectRatio="none") svg renders ~1.6× taller
   than before, so the waves are ±0.6 range in viewBox units to keep the same
   rendered px height. */
const FUEL_WAVE_1 =
  "M 0,45 C 22.2,30 44.4,60 66.7,45 C 88.9,30 111.1,60 133.3,45 C 155.6,30 177.8,60 200,45";
const FUEL_WAVE_2 =
  "M 0,75 C 22.2,63 44.4,87 66.7,75 C 88.9,63 111.1,87 133.3,75 C 155.6,63 177.8,87 200,75";

const FuelChart = memo(function FuelChart() {
  const reduced = useReducedMotion();
  const chartRef = useMotionPause<HTMLDivElement>();

  return (
    <div ref={chartRef} className="bento-chart">
      <svg viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden>
        {/* static waves, reference-style: bright lead wave + dim echo */}
        <path
          id="fuel-wave-1"
          className="bento-mot"
          d={FUEL_WAVE_1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="bento-motd"
          d={FUEL_WAVE_2}
          vectorEffect="non-scaling-stroke"
        />
        {!reduced && <WanderOrb pathId="fuel-wave-1" dur="14s" />}
      </svg>
      {reduced && (
        /* on wave 1 near the right end — the x=133.3, y=45 node of the curve */
        <ChartDot
          leftPct={66.7}
          topPct={37.5}
          color="var(--accent)"
          glow="5px var(--accent)"
        />
      )}
    </div>
  );
});

const CANDLES = [
  { x: 40, wickTop: 20, wickBottom: 55, bodyY: 45, bodyH: 24 },
  { x: 90, wickTop: 10, wickBottom: 50, bodyY: 18, bodyH: 28 },
  { x: 150, wickTop: 25, wickBottom: 60, bodyY: 32, bodyH: 22 },
  { x: 200, wickTop: 5, wickBottom: 45, bodyY: 10, bodyH: 30 },
];

const CANDLE_GREEN = "#4ade80";

const BusinessChart = memo(function BusinessChart() {
  const reduced = useReducedMotion();
  const chartRef = useMotionPause<HTMLDivElement>();

  return (
    <div ref={chartRef} className="bento-chart">
      <svg viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden>
        {CANDLES.map(({ x, wickTop, wickBottom, bodyY, bodyH }, i) => (
          <g
            key={x}
            className="bento-candle-in"
            /* mount-only rise-in, staggered left to right */
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <line
              className="bento-candle-wick"
              x1={x}
              y1={wickTop}
              x2={x}
              y2={wickBottom}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              className="bento-candle-body"
              x={x - 7}
              y={bodyY}
              width={14}
              height={bodyH}
              rx={4}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {/* invisible track over the wick tops for the hopping orb */}
        <path
          id="business-path"
          d="M 40,14 L 90,4 L 150,19 L 200,1"
          fill="none"
          stroke="none"
        />
        {!reduced && (
          <WanderOrb
            pathId="business-path"
            dur="12s"
            color={CANDLE_GREEN}
            /* dwell on each candle, hop to the next (reference orb mode "hop") */
            keyPoints="0;0;0.33;0.33;0.66;0.66;1;1;0.66;0.66;0.33;0.33;0;0"
            keyTimes="0;0.1;0.15;0.25;0.3;0.4;0.45;0.55;0.6;0.7;0.75;0.85;0.9;1"
          />
        )}
      </svg>
    </div>
  );
}
