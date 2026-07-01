"use client";

import { useEffect, useRef } from "react";

const MOUNTAINS = (
  <svg viewBox="0 0 1600 420" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="vt-mt-far" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0d1a17" stopOpacity="0" />
        <stop offset="55%" stopColor="#0d1a17" stopOpacity=".55" />
        <stop offset="100%" stopColor="#0d1a17" stopOpacity=".95" />
      </linearGradient>
      <linearGradient id="vt-mt-near" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#050a09" stopOpacity=".4" />
        <stop offset="60%" stopColor="#050a09" stopOpacity=".95" />
        <stop offset="100%" stopColor="#050a09" stopOpacity="1" />
      </linearGradient>
    </defs>
    <path
      d="M0,300 L120,230 L210,260 L320,180 L430,220 L560,150 L680,210 L820,170 L960,220 L1100,180 L1240,240 L1380,200 L1500,250 L1600,220 L1600,420 L0,420 Z"
      fill="url(#vt-mt-far)"
    />
    <path
      d="M0,360 L100,320 L220,340 L340,290 L460,330 L590,300 L720,340 L860,310 L1000,350 L1140,310 L1280,355 L1420,320 L1540,360 L1600,340 L1600,420 L0,420 Z"
      fill="url(#vt-mt-near)"
    />
  </svg>
);

export default function VitalityBackdrop() {
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = particlesRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const count = window.innerWidth < 640 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      const dur = 18 + Math.random() * 22;
      const size = 1 + Math.random() * 1.2;
      span.style.left = `${Math.random() * 100}%`;
      span.style.top = `${60 + Math.random() * 40}vh`;
      span.style.width = span.style.height = `${size}px`;
      span.style.animationDuration = `${dur}s`;
      span.style.animationDelay = `${-Math.random() * dur}s`;
      span.style.setProperty("--dx", `${Math.random() * 30 - 15}px`);
      span.style.setProperty("--dy", `${-(60 + Math.random() * 50)}vh`);
      root.appendChild(span);
    }

    return () => {
      root.replaceChildren();
    };
  }, []);

  return (
    <>
      <div id="vt-backdrop" aria-hidden="true">
        <div className="wb-atmosphere" />
        <div className="wb-mountains">{MOUNTAINS}</div>
        <div className="wb-mist" />
        <div className="wb-particles" ref={particlesRef} />
      </div>
      <div id="vt-grain" aria-hidden="true" />
    </>
  );
}
