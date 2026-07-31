"use client";

import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const Ferrofluid = dynamic(() => import("@/components/ferrofluid"), {
  ssr: false,
  loading: () => null,
});

type HomeBackgroundProps = {
  /** Dashboard uses CSS-only ambient bg — avoids loading WebGL on search pages. */
  mode?: "full" | "lite";
};

/** Ice-blue ferrofluid contours on void black (Anya palette). */
const FERRO_COLORS = ["#9aafc4", "#6e869e", "#b0c4d6"];

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
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050508]"
    >
      <Ferrofluid
        colors={FERRO_COLORS}
        flowDirection="down"
        fluidity={0.1}
        glow={1.25}
        mouseDampening={0.18}
        mouseInteraction
        mouseRadius={0.32}
        mouseStrength={0.75}
        opacity={0.62}
        rimWidth={0.2}
        scale={1.55}
        sharpness={2.4}
        shimmer={0.95}
        speed={0.24}
        turbulence={0.95}
      />
    </div>
  );
}
