"use client";

import { useEffect, useState } from "react";
import CountUp from "@/components/motion/CountUp";
import { useReducedMotion } from "@/lib/motion";

interface MacroRingProps {
  /** Calories logged today. */
  calories: number;
  /** Daily calorie goal — the ring fills toward this. */
  goalCalories: number;
  size?: number;
}

/**
 * Compact calorie-progress donut for the Fuel card. A single mint arc fills
 * from 0 toward the day's goal; the centre shows today's calorie total in mono.
 * Distinct from the onboarding MacroDonut, which is a large 3-segment target
 * ring — this one is a small single-value progress ring.
 */
export default function MacroRing({
  calories,
  goalCalories,
  size = 60,
}: MacroRingProps) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const swept = mounted || reduced;

  const fraction =
    goalCalories > 0 ? Math.max(0, Math.min(1, calories / goalCalories)) : 0;
  // 0 until the mount frame flips `swept`, so the arc sweeps up (700ms cubic).
  const dash = (swept ? fraction : 0) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{
              transition:
                "stroke-dasharray 700ms cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <CountUp
          value={Math.round(calories)}
          className="mono text-[0.72rem] font-semibold leading-none"
        />
      </div>
    </div>
  );
}
