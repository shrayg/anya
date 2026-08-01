"use client";

import { useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const PixelBlast = dynamic(() => import("@/components/pixel-blast"), {
  ssr: false,
  loading: () => null,
});

type HomeBackgroundProps = {
  /** Dashboard uses CSS-only ambient bg — avoids loading WebGL on search pages. */
  mode?: "full" | "lite";
};

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
  const reduceMotion = useReducedMotion();

  if (mode === "lite") {
    return <LiteBackground />;
  }

  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#050508]">
      <PixelBlast
        enableRipples
        liquid
        transparent
        color="#727171"
        edgeFade={0.25}
        liquidRadius={1.2}
        liquidStrength={0.12}
        liquidWobbleSpeed={5}
        patternDensity={1.15}
        patternScale={3}
        paused={Boolean(reduceMotion)}
        pixelSize={3}
        pixelSizeJitter={1.05}
        rippleIntensityScale={1.5}
        rippleSpeed={0.4}
        rippleThickness={0.12}
        speed={0.4}
        variant="diamond"
      />
      {/* Scrim keeps body copy legible over the dither without flattening the
          pattern. pointer-events stay off so ripples still reach the canvas. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 85% 55% at 50% 38%, rgba(5,5,8,0.86) 0%, rgba(5,5,8,0.6) 55%, rgba(5,5,8,0.28) 100%)",
            "linear-gradient(180deg, rgba(5,5,8,0.35) 0%, rgba(5,5,8,0.55) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
