"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";

const VIDEO_SRC = "/videos/splash-intro.mp4";

/** Final title box in the 1920×1080 master (from last-frame pixel bounds). */
const MASTER = {
  width: 1920,
  height: 1080,
  textWidth: 848,
  textHeight: 192,
  centerX: 957,
  centerY: 565,
} as const;

const HANDOFF_MS = 1.15;
const HANDOFF_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Phase = "playing" | "handoff" | "done";

type HandoffGeometry = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Final (hero) font size — locked; resize is done via GPU scale */
  fontSize: number;
  /** fromSize / toSize — start scale so glyphs match the video end frame */
  startScale: number;
};

function measureVideoEndGeometry(viewportW: number, viewportH: number) {
  const scale = Math.min(viewportW / MASTER.width, viewportH / MASTER.height);
  const offsetX = (viewportW - MASTER.width * scale) / 2;
  const offsetY = (viewportH - MASTER.height * scale) / 2;

  return {
    x: offsetX + MASTER.centerX * scale,
    y: offsetY + MASTER.centerY * scale,
    // Glyph box height ≈ 192px; cap-height tracks ~font-size closely for bold sans
    fontSize: MASTER.textHeight * scale * 0.92,
  };
}

function measureHeroTarget(): {
  x: number;
  y: number;
  fontSize: number;
} | null {
  const target = document.querySelector<HTMLElement>("[data-splash-target]");
  if (!target) return null;

  const rect = target.getBoundingClientRect();
  const computed = window.getComputedStyle(target);
  const fontSize =
    Number.parseFloat(computed.fontSize) ||
    (window.innerWidth >= 768 ? 96 : 48);

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    fontSize,
  };
}

export const SplashScreen = () => {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const videoRef = useRef<HTMLVideoElement>(null);
  const handoffStarted = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [geometry, setGeometry] = useState<HandoffGeometry | null>(null);

  const bgOpacity = useMotionValue(1);
  const videoOpacity = useMotionValue(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isHome) {
      setPhase("done");
      return;
    }

    document.documentElement.dataset.splash = "active";
    document.documentElement.style.overflow = "hidden";

    return () => {
      delete document.documentElement.dataset.splash;
      document.documentElement.style.overflow = "";
    };
  }, [mounted, isHome]);

  const finish = useCallback(() => {
    delete document.documentElement.dataset.splash;
    document.documentElement.style.overflow = "";
    setPhase("done");
  }, []);

  const beginHandoff = useCallback(() => {
    if (handoffStarted.current) return;
    handoffStarted.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = measureVideoEndGeometry(window.innerWidth, window.innerHeight);
    const to = measureHeroTarget() ?? {
      x: from.x,
      y: Math.max(120, window.innerHeight * 0.28),
      fontSize: window.innerWidth >= 768 ? 96 : 48,
    };

    if (reduced) {
      animate(bgOpacity, 0, { duration: 0.2 });
      animate(videoOpacity, 0, { duration: 0.15 });
      window.setTimeout(finish, 220);
      setPhase("handoff");
      return;
    }

    const startScale = Math.max(0.01, from.fontSize / to.fontSize);

    setGeometry({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      fontSize: to.fontSize,
      startScale,
    });
    setPhase("handoff");

    // Video drops out so the live type takes over on the last frame pose
    animate(videoOpacity, 0, {
      duration: 0.18,
      ease: [0.4, 0, 0.2, 1],
    });

    // Background keeps fading while the title continues its shift-up tween
    animate(bgOpacity, 0, {
      duration: HANDOFF_MS,
      ease: HANDOFF_EASE,
    });
  }, [bgOpacity, finish, videoOpacity]);

  useEffect(() => {
    if (!mounted || !isHome || phase !== "playing") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      beginHandoff();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const safety = window.setTimeout(() => beginHandoff(), 7000);

    const tryPlay = async () => {
      try {
        video.currentTime = 0;
        await video.play();
      } catch {
        beginHandoff();
      }
    };

    void tryPlay();

    return () => window.clearTimeout(safety);
  }, [mounted, isHome, phase, beginHandoff]);

  if (!mounted || !isHome || phase === "done") {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        pointerEvents: phase === "playing" ? "auto" : "none",
      }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 bg-black"
        style={{ opacity: bgOpacity }}
      />

      <motion.video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        style={{ opacity: videoOpacity }}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        onEnded={beginHandoff}
        onError={beginHandoff}
      />

      {phase === "handoff" && geometry ? (
        <motion.span
          className="pointer-events-none fixed left-0 top-0 z-[101] whitespace-nowrap font-extrabold tracking-normal text-[#c8c8c8]"
          initial={{
            x: geometry.fromX,
            y: geometry.fromY,
            scale: geometry.startScale,
          }}
          animate={{
            x: geometry.toX,
            y: geometry.toY,
            scale: 1,
          }}
          transition={{
            duration: HANDOFF_MS,
            ease: HANDOFF_EASE,
          }}
          transformTemplate={({ x, y, scale }) =>
            `translate3d(${x}, ${y}, 0) translate(-50%, -50%) scale(${scale})`
          }
          style={{
            fontSize: geometry.fontSize,
            lineHeight: 1.15,
            willChange: "transform",
            backfaceVisibility: "hidden",
            textRendering: "geometricPrecision",
          }}
          onAnimationComplete={finish}
        >
          {siteConfig.name}
        </motion.span>
      ) : null}
    </motion.div>
  );
};
