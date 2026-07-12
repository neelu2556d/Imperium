"use client";

import { useEffect, useState } from "react";
import CountUp from "@/components/motion/CountUp";
import { useReducedMotion } from "@/lib/motion";

/**
 * The Fuel tab's hero ring. The circle is split into three equal arcs — one
 * per macro — and each arc fills from its start toward that macro's goal
 * (capped at 100%). Protein is mint, carbs amber, fat a muted white-grey,
 * matching the stat pills below it. The centre shows today's total calories
 * over the day's calorie goal. Everything transitions smoothly, so the ring
 * animates live as meals are logged.
 *
 * On mount each arc sweeps from 0 to its real value (700ms easeOutCubic),
 * staggered protein → carbs → fat 100ms apart, and the centre calorie total
 * counts up. Both honour prefers-reduced-motion.
 */

export const PROTEIN_COLOR = "var(--color-mint)";
export const CARBS_COLOR = "var(--color-amber)";
export const FAT_COLOR = "rgba(255, 255, 255, 0.55)";

interface Macro {
  logged: number;
  goal: number;
  color: string;
}

interface FuelRingProps {
  calories: number;
  goalCalories: number;
  protein: Macro;
  carbs: Macro;
  fat: Macro;
  size?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export default function FuelRing({
  calories,
  goalCalories,
  protein,
  carbs,
  fat,
  size = 220,
}: FuelRingProps) {
  const reduced = useReducedMotion();
  // Gate the arc sweep: render at 0 fill on first paint, flip to real values on
  // the next frame so the CSS transition animates 0 → value on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const swept = mounted || reduced;

  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const macros = [protein, carbs, fat];

  // Each macro owns a third of the circle, separated by a small visual gap.
  const gap = circumference * 0.03;
  const segment = circumference / 3;
  const arcLen = segment - gap;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Macro progress toward today's goals"
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          {macros.map((m, i) => {
            const offset = i * segment;
            const frac = m.goal > 0 ? clamp01(m.logged / m.goal) : 0;
            // 0 until the mount frame flips `swept` on, so the arc sweeps up.
            const fillLen = arcLen * (swept ? frac : 0);
            return (
              <g key={i}>
                {/* track — the macro's colour, dimmed */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={m.color}
                  strokeOpacity={0.16}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${arcLen} ${circumference - arcLen}`}
                  strokeDashoffset={-offset}
                />
                {/* fill — proportional to logged / goal */}
                {fillLen > 0 && (
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${fillLen} ${circumference - fillLen}`}
                    strokeDashoffset={-offset}
                    style={{
                      // Mount sweep: 700ms easeOutCubic, staggered per macro
                      // (protein → carbs → fat, 100ms apart). Once mounted this
                      // same transition also carries live updates as meals log.
                      transition:
                        "stroke-dasharray 700ms cubic-bezier(0.33, 1, 0.68, 1)",
                      transitionDelay: swept ? `${i * 100}ms` : "0ms",
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp
          value={Math.round(calories)}
          className="mono text-4xl font-semibold leading-none tabular-nums"
        />
        <span className="mono mt-1.5 text-[0.72rem] tracking-[0.04em] text-muted">
          / {Math.round(goalCalories)} kcal
        </span>
      </div>
    </div>
  );
}
