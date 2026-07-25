import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Imperium faceted diamond logo for Apple home-screen icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <svg viewBox="0 0 120 150" width={108} height={135}>
          {/* Left-top facet — light */}
          <polygon points="60,8 22,46 60,72" fill="#6ee7b7" />
          {/* Right-top facet — base mint */}
          <polygon points="60,8 98,46 60,72" fill="#34d399" />
          {/* Left-bottom facet — deep */}
          <polygon points="22,46 32,112 60,72" fill="#059669" />
          {/* Right-bottom facet — hover */}
          <polygon points="98,46 88,112 60,72" fill="#10b981" />
          {/* Bottom-center facet — base mint */}
          <polygon points="32,112 60,132 60,72" fill="#34d399" />
          {/* Bottom-right facet — deep */}
          <polygon points="88,112 60,132 60,72" fill="#059669" />
          {/* Top edge highlight */}
          <polygon
            points="60,8 22,46 98,46"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
