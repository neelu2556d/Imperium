"use client";

/**
 * Imperium (brand) tile art — a field of mint motes orbiting the centred gem.
 * Rendered absolutely-positioned dots (not SVG) so each can carry its own CSS
 * custom props for orbit radius / period / phase via the `.vee-mote` keyframe.
 */

const MOTES = [
  { r: 46, orb: "9s", d: "0s", size: 4, op: 0.9 },
  { r: 64, orb: "13s", d: "-3s", size: 3, op: 0.7 },
  { r: 58, orb: "11s", d: "-6s", size: 2.5, op: 0.6 },
  { r: 78, orb: "16s", d: "-9s", size: 3.5, op: 0.5 },
  { r: 40, orb: "8s", d: "-2s", size: 2, op: 0.8 },
  { r: 88, orb: "18s", d: "-12s", size: 2.5, op: 0.4 },
];

export default function MotesArt() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
      <div className="relative h-0 w-0">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="vee-mote absolute rounded-full"
            style={
              {
                left: 0,
                top: 0,
                width: m.size,
                height: m.size,
                marginLeft: -m.size / 2,
                marginTop: -m.size / 2,
                background: "var(--color-mint-soft)",
                opacity: m.op,
                "--r": `${m.r}px`,
                "--orb": m.orb,
                "--d": m.d,
                filter:
                  "drop-shadow(0 0 4px rgba(110,231,183,0.9)) drop-shadow(0 0 8px rgba(110,231,183,0.5))",
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
