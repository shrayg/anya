"use client";

import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const FloatingLines = dynamic(() => import("@/components/floating-lines"), {
  ssr: false,
  loading: () => null,
});

/** Anya ice-blue (`#c3d3e6` / `--anya-blush`) line stops on void black. */
const LINES_GRADIENT = ["#8fa8c4", "#c3d3e6", "#e8f0f8"];
const VOID_BLACK = "#000000";

/**
 * URL preview used bendStrength=-1.5; dialed milder so any future interactive
 * bend stays subtle while keeping bendRadius at 30.
 */
const BEND_RADIUS = 30;
const BEND_STRENGTH = -0.5;

type HomeBackgroundProps = {
  /** `lite` = CSS-only ambient bg (no WebGL). Default `full` matches marketing. */
  mode?: "full" | "lite";
  /** Stronger darkening for dense UIs (dashboard) without hiding the pattern. */
  denser?: boolean;
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
          `linear-gradient(180deg, ${VOID_BLACK} 0%, #0a0a0b 55%, ${VOID_BLACK} 100%)`,
        ].join(", "),
      }}
    />
  );
}

export function HomeBackground({
  mode = "full",
  denser = false,
}: HomeBackgroundProps) {
  if (mode === "lite") {
    return <LiteBackground />;
  }

  const scrim = denser
    ? [
        "radial-gradient(ellipse 90% 60% at 50% 38%, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.74) 55%, rgba(0,0,0,0.42) 100%)",
        "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.68) 100%)",
      ].join(", ")
    : [
        "radial-gradient(ellipse 85% 55% at 50% 38%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.28) 100%)",
        "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.52) 100%)",
      ].join(", ");

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
    >
      <div className="absolute inset-0">
        <FloatingLines
          animationSpeed={0.7}
          bendRadius={BEND_RADIUS}
          bendStrength={BEND_STRENGTH}
          enabledWaves={["top", "bottom", "middle"]}
          interactive={false}
          linesGradient={LINES_GRADIENT}
          mixBlendMode="screen"
          parallax={false}
          suspendWhenOffscreen
        />
      </div>
      {/* Scrim keeps glass sidebar / copy legible over the floating lines. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: scrim }}
      />
    </div>
  );
}
