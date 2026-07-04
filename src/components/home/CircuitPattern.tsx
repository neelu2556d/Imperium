/**
 * Decorative PCB-trace backdrop for the Imperium card — thin straight lines
 * with right-angle bends in deep mint, faintly filling the card behind the
 * gem. Purely aesthetic; not a real circuit. Absolutely positioned to cover
 * its (relative) parent.
 */
export default function CircuitPattern({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <g
        fill="none"
        stroke="var(--color-mint-deep)"
        strokeWidth="1"
        opacity="0.4"
      >
        {/* horizontal traces with right-angle risers */}
        <path d="M0 28 H70 V52 H130" />
        <path d="M300 40 H210 V70 H150" />
        <path d="M0 96 H48 V72 H96 V96 H160" />
        <path d="M300 110 H236 V140 H188" />
        <path d="M0 150 H60 V128 H108" />
        <path d="M300 168 H220 V150 H164" />
        <path d="M0 180 H92 V160 H150 V184 H210" />
        {/* vertical traces */}
        <path d="M40 0 V44 H24" />
        <path d="M264 0 V36 H288" />
        <path d="M120 200 V156 H150" />
        <path d="M200 200 V176" />
        {/* solder pads */}
        <circle cx="130" cy="52" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
        <circle cx="150" cy="70" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
        <circle cx="160" cy="96" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
        <circle cx="188" cy="140" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
        <circle cx="108" cy="128" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
        <circle cx="164" cy="150" r="2.4" fill="var(--color-mint-deep)" stroke="none" />
      </g>
    </svg>
  );
}
