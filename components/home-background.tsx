"use client";

import LightPillar from "@/components/light-pillar";
import { themeAccent } from "@/config/branding";

export function HomeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
      <LightPillar
        bottomColor={themeAccent.pillarBottom}
        glowAmount={0.001}
        intensity={0.55}
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
