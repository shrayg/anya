"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

const HOLD_MS = 2000;
const REVEAL_MS = 0.7;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Phase = "hold" | "reveal" | "done";

/**
 * Home splash: veil + spinner only.
 * Never moves, clones, or restyles the homepage ShinyText — that caused the fly/flash bugs.
 * CSS raises the real wordmark above the veil in its layout position; then the veil fades.
 */
export const SplashScreen = () => {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const started = useRef(false);
  const finishedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(() =>
    typeof window === "undefined" ? "hold" : pathname === "/" ? "hold" : "done",
  );

  const bgOpacity = useMotionValue(1);
  const spinnerOpacity = useMotionValue(1);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    delete document.documentElement.dataset.splash;
    document.body.style.overflow = "";
    setPhase("done");
  }, []);

  useLayoutEffect(() => {
    if (!isHome) {
      setPhase("done");
      return;
    }

    finishedRef.current = false;
    document.documentElement.dataset.splash = "active";
    document.body.style.overflow = "hidden";

    return () => {
      delete document.documentElement.dataset.splash;
      document.body.style.overflow = "";
    };
  }, [isHome]);

  useEffect(() => {
    if (!isHome || phase !== "hold") return;
    if (started.current) return;
    started.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 200 : HOLD_MS;

    const timer = window.setTimeout(() => setPhase("reveal"), wait);
    return () => window.clearTimeout(timer);
  }, [isHome, phase]);

  useEffect(() => {
    if (!isHome || phase === "done") return;
    const safety = window.setTimeout(finish, HOLD_MS + REVEAL_MS * 1000 + 1000);
    return () => window.clearTimeout(safety);
  }, [isHome, phase, finish]);

  useLayoutEffect(() => {
    if (phase !== "reveal") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0.2 : REVEAL_MS;

    void animate(spinnerOpacity, 0, {
      duration: Math.min(0.25, duration),
      ease: EASE,
    });
    void animate(bgOpacity, 0, { duration, ease: EASE }).then(finish);
  }, [phase, bgOpacity, spinnerOpacity, finish]);

  if (!isHome || phase === "done") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: phase === "hold" ? "auto" : "none" }}
      aria-hidden
    >
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: bgOpacity }} />

      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: bgOpacity }}
      >
        <div className="absolute left-1/2 top-0 h-full w-[min(40vw,18rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,transparent_68%)]" />
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-[calc(50%+5.5rem)] z-[101] -translate-x-1/2"
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
