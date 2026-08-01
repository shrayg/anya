"use client";

import dynamic from "next/dynamic";

import { themeAccent } from "@/config/branding";

const Prism = dynamic(() => import("@/components/prism"), {
  ssr: false,
  loading: () => null,
});

/** Anya ice-blue (`#c3d3e6` / `--anya-blush`) on void — not the default React Bits purple. */
const PRISM_HUE_SHIFT = 0.52;
const PRISM_COLOR_FREQUENCY = 0.88;
const VOID_BLACK = "#000000";

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
        "radial-gradient(ellipse 90% 60% at 50% 38%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.48) 100%)",
        "linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.72) 100%)",
      ].join(", ")
    : [
        "radial-gradient(ellipse 85% 55% at 50% 38%, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.32) 100%)",
        "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.58) 100%)",
      ].join(", ");

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
    >
      <div className="absolute inset-0 opacity-90">
        <Prism
          animationType="3drotate"
          bloom={0.85}
          colorFrequency={PRISM_COLOR_FREQUENCY}
          glow={1.05}
          height={3.5}
          hueShift={PRISM_HUE_SHIFT}
          noise={0.22}
          scale={3.6}
          suspendWhenOffscreen
          timeScale={0.38}
          transparent
        />
      </div>
      {/* Scrim keeps glass sidebar / copy legible over the prism bloom. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: scrim }}
      />
    </div>
  );
}
