"use client";

import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const ColorBends = dynamic(() => import("@/components/color-bends"), {
  ssr: false,
  loading: () => null,
});

type HomeBackgroundProps = {
  /** Dashboard uses CSS-only ambient bg — avoids loading Three.js on search pages. */
  mode?: "full" | "lite";
};

const BEND_COLORS = [
  themeAccent.blush,
  themeAccent.pillarTop,
  themeAccent.blushHover,
];

function LiteBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        background: [
          `radial-gradient(ellipse 70% 55% at 50% 35%, ${themeAccent.pillarTop}28, transparent 68%)`,
          `radial-gradient(ellipse 55% 45% at 70% 70%, ${themeAccent.pillarBottom}18, transparent 62%)`,
          "linear-gradient(180deg, #07070c 0%, #0b0b12 55%, #08080e 100%)",
        ].join(", "),
      }}
    />
  );
}

export function HomeBackground({ mode = "full" }: HomeBackgroundProps) {
  if (mode === "lite") {
    return <LiteBackground />;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07070c]"
    >
      <ColorBends
        autoRotate={0}
        bandWidth={6}
        colors={BEND_COLORS}
        frequency={1}
        intensity={1.35}
        mouseInfluence={0.6}
        noise={0.12}
        parallax={0.4}
        rotation={90}
        scale={1}
        speed={0.2}
        style={{ width: "100%", height: "100%" }}
        transparent
        warpStrength={1}
      />
    </div>
  );
}
