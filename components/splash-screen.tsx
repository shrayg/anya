"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";

const HOLD_MS = 2000;
const REVEAL_MS = 0.95;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Phase = "hold" | "reveal" | "done";

function measureHeroTarget() {
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
  const started = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("hold");
  const [fontSize, setFontSize] = useState(96);

  const bgOpacity = useMotionValue(1);
  const spinnerOpacity = useMotionValue(1);
  const textX = useMotionValue(0);
  const textY = useMotionValue(0);
  const textScale = useMotionValue(1);

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

  // Seed centered text once we know viewport size
  useLayoutEffect(() => {
    if (!mounted || !isHome || phase === "done") return;

    const to = measureHeroTarget();
    const size = to?.fontSize ?? (window.innerWidth >= 768 ? 96 : 48);
    setFontSize(size);

    // Start at true viewport center, sized to final hero type (GPU scale only later)
    textX.set(window.innerWidth / 2);
    textY.set(window.innerHeight / 2);
    textScale.set(1.12);
  }, [mounted, isHome, phase, textX, textY, textScale]);

  useEffect(() => {
    if (!mounted || !isHome || phase !== "hold") return;
    if (started.current) return;
    started.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 200 : HOLD_MS;

    const timer = window.setTimeout(() => setPhase("reveal"), wait);
    return () => window.clearTimeout(timer);
  }, [mounted, isHome, phase]);

  useLayoutEffect(() => {
    if (phase !== "reveal") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const to = measureHeroTarget() ?? {
      x: window.innerWidth / 2,
      y: Math.max(120, window.innerHeight * 0.28),
      fontSize: window.innerWidth >= 768 ? 96 : 48,
    };

    setFontSize(to.fontSize);

    if (reduced) {
      void animate(bgOpacity, 0, { duration: 0.2 });
      void animate(spinnerOpacity, 0, { duration: 0.15 });
      window.setTimeout(finish, 220);
      return;
    }

    void animate(spinnerOpacity, 0, { duration: 0.25, ease: EASE });
    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE });

    void Promise.all([
      animate(textX, to.x, { duration: REVEAL_MS, ease: EASE }),
      animate(textY, to.y, { duration: REVEAL_MS, ease: EASE }),
      animate(textScale, 1, { duration: REVEAL_MS, ease: EASE }),
    ]).then(finish);
  }, [phase, bgOpacity, spinnerOpacity, textX, textY, textScale, finish]);

  if (!mounted || !isHome || phase === "done") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: phase === "hold" ? "auto" : "none" }}
      aria-hidden
    >
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: bgOpacity }} />

      {/* Soft vertical light streak behind the wordmark */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: bgOpacity }}
      >
        <div className="absolute left-1/2 top-0 h-full w-[min(40vw,18rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,transparent_68%)]" />
      </motion.div>

      <motion.span
        className="pointer-events-none absolute left-0 top-0 z-[101] whitespace-nowrap font-extrabold tracking-normal text-white"
        style={{
          x: textX,
          y: textY,
          scale: textScale,
          fontSize,
          lineHeight: 1.15,
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
        transformTemplate={({ x, y, scale }) =>
          `translate3d(${x}, ${y}, 0) translate(-50%, -50%) scale(${scale})`
        }
      >
        {siteConfig.name}
      </motion.span>

      <motion.div
        className="absolute left-1/2 top-[calc(50%+4.5rem)] z-[101] -translate-x-1/2"
        style={{ opacity: spinnerOpacity }}
      >
        <div
          className="size-8 rounded-full border-2 border-white/20 border-t-white animate-spin"
          role="status"
          aria-label="Loading"
        />
      </motion.div>
    </div>
  );
};
