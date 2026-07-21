"use client";

import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const LightPillar = dynamic(() => import("@/components/light-pillar"), {
  ssr: false,
  loading: () => null,
});

type HomeBackgroundProps = {
  /** Dashboard uses CSS-only ambient bg — avoids loading Three.js on search pages. */
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
  if (mode === "lite") {
    return <LiteBackground />;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
      <LightPillar
        bottomColor={themeAccent.pillarBottom}
        glowAmount={0.001}
        intensity={0.4}
        interactive={false}
        mixBlendMode="screen"
        noiseIntensity={0.1}
        pillarHeight={0.2}
        pillarRotation={25}
        pillarWidth={3}
        quality="high"
        rotationSpeed={0.5}
        topColor={themeAccent.pillarTop}
      />
    </div>
  );
}
