"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

/** Hold the last painted frame slightly before `ended` (some browsers go black on ended). */
const FREEZE_BEFORE_END_S = 0.08;

const CROSSFADE_MS = 0.55;
const MORPH_MS = 1.1;
const MORPH_DELAY_MS = 0.28;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Phase = "playing" | "handoff" | "done";

type HandoffGeometry = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fontSize: number;
  startScale: number;
};

function measureVideoEndGeometry(viewportW: number, viewportH: number) {
  const scale = Math.min(viewportW / MASTER.width, viewportH / MASTER.height);
  const offsetX = (viewportW - MASTER.width * scale) / 2;
  const offsetY = (viewportH - MASTER.height * scale) / 2;

  return {
    x: offsetX + MASTER.centerX * scale,
    y: offsetY + MASTER.centerY * scale,
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

function holdLastFrame(video: HTMLVideoElement) {
  try {
    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0) {
      video.currentTime = Math.max(0, duration - FREEZE_BEFORE_END_S);
    }
    video.pause();
  } catch {
    try {
      video.pause();
    } catch {
      // ignore
    }
  }
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
  const bridgeX = useMotionValue(0);
  const bridgeY = useMotionValue(0);
  const bridgeScale = useMotionValue(1);
  const bridgeOpacity = useMotionValue(0);

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

    const video = videoRef.current;
    if (video) holdLastFrame(video);

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

    // Seed bridge under the frozen video frame before we paint / crossfade
    bridgeX.set(from.x);
    bridgeY.set(from.y);
    bridgeScale.set(startScale);
    bridgeOpacity.set(1);

    setGeometry({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      fontSize: to.fontSize,
      startScale,
    });
    setPhase("handoff");
  }, [
    bgOpacity,
    bridgeOpacity,
    bridgeScale,
    bridgeX,
    bridgeY,
    finish,
    videoOpacity,
  ]);

  // After bridge text is in the DOM (matched to video end), crossfade video→text,
  // then morph the text into the hero while the black veil fades.
  useLayoutEffect(() => {
    if (phase !== "handoff" || !geometry) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let cancelled = false;
    const timers: number[] = [];

    // Ensure one paint with text under video at matching pose
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;

        // Soft reveal: freeze video dissolves into the matched live type (no black gap)
        void animate(videoOpacity, 0, {
          duration: CROSSFADE_MS,
          ease: [0.4, 0, 0.2, 1],
        });

        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;

            void animate(bgOpacity, 0, {
              duration: MORPH_MS,
              ease: EASE,
            });

            void Promise.all([
              animate(bridgeX, geometry.toX, { duration: MORPH_MS, ease: EASE }),
              animate(bridgeY, geometry.toY, { duration: MORPH_MS, ease: EASE }),
              animate(bridgeScale, 1, { duration: MORPH_MS, ease: EASE }),
            ]).then(() => {
              if (!cancelled) finish();
            });
          }, MORPH_DELAY_MS * 1000),
        );
      }, 32),
    );

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [
    phase,
    geometry,
    bgOpacity,
    videoOpacity,
    bridgeX,
    bridgeY,
    bridgeScale,
    finish,
  ]);

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

    const onTimeUpdate = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (video.currentTime >= duration - FREEZE_BEFORE_END_S) {
        beginHandoff();
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);

    const tryPlay = async () => {
      try {
        video.currentTime = 0;
        await video.play();
      } catch {
        beginHandoff();
      }
    };

    void tryPlay();

    return () => {
      window.clearTimeout(safety);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [mounted, isHome, phase, beginHandoff]);

  if (!mounted || !isHome || phase === "done") {
    return null;
  }

  return (
    <div
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

      {/* Bridge type sits under the video so the dissolve never shows black */}
      {phase === "handoff" && geometry ? (
        <motion.span
          className="pointer-events-none absolute left-0 top-0 z-[101] whitespace-nowrap font-extrabold tracking-normal text-[#c8c8c8]"
          style={{
            x: bridgeX,
            y: bridgeY,
            scale: bridgeScale,
            opacity: bridgeOpacity,
            fontSize: geometry.fontSize,
            lineHeight: 1.15,
            willChange: "transform",
            backfaceVisibility: "hidden",
            textRendering: "geometricPrecision",
          }}
          transformTemplate={({ x, y, scale }) =>
            `translate3d(${x}, ${y}, 0) translate(-50%, -50%) scale(${scale})`
          }
        >
          {siteConfig.name}
        </motion.span>
      ) : null}

      <motion.video
        ref={videoRef}
        className="absolute inset-0 z-[102] h-full w-full object-contain bg-black"
        style={{ opacity: videoOpacity }}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        onEnded={beginHandoff}
        onError={beginHandoff}
      />
    </div>
  );
};
