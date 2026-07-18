"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

const HOLD_MS = 1800;
const REVEAL_MS = 1.2;
const EASE: [number, number, number, number] = [0.45, 0.05, 0.25, 1];
const TARGET_SEL = "[data-splash-target]";

type Phase = "hold" | "reveal" | "done";

function getTarget() {
  return document.querySelector<HTMLElement>(TARGET_SEL);
}

function setShift(px: number) {
  document.documentElement.style.setProperty("--splash-shift", `${px}px`);
}

function clearShift() {
  document.documentElement.style.removeProperty("--splash-shift");
}

/**
 * Splash veil + spinner. Homepage ShinyText is the only wordmark.
 * Hold: CSS translateY to viewport center (no transition).
 * Reveal: CSS transition on transform for a single sleek glide up.
 */
export const SplashScreen = () => {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const started = useRef(false);
  const finishedRef = useRef(false);
  const shiftFromRef = useRef(0);

  const [phase, setPhase] = useState<Phase>(() =>
    typeof window === "undefined" ? "hold" : pathname === "/" ? "hold" : "done",
  );

  const bgOpacity = useMotionValue(1);
  const spinnerOpacity = useMotionValue(1);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setShift(0);
    clearShift();
    delete document.documentElement.dataset.splash;
    delete document.documentElement.dataset.splashPhase;
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
    document.documentElement.dataset.splashPhase = "hold";
    document.body.style.overflow = "hidden";
    setShift(0);

    return () => {
      clearShift();
      delete document.documentElement.dataset.splash;
      delete document.documentElement.dataset.splashPhase;
      document.body.style.overflow = "";
    };
  }, [isHome]);

  useLayoutEffect(() => {
    if (!isHome || phase !== "hold") return;

    let cancelled = false;
    let raf = 0;

    const place = () => {
      if (cancelled) return;
      const el = getTarget();
      if (!el) {
        raf = requestAnimationFrame(place);
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.height < 8) {
        raf = requestAnimationFrame(place);
        return;
      }

      const naturalCenterY = rect.top + rect.height / 2;
      const viewCenterY = window.innerHeight / 2;
      const shift = viewCenterY - naturalCenterY;
      shiftFromRef.current = shift;
      // Hold: snap to center with no transition
      document.documentElement.dataset.splashPhase = "hold";
      setShift(shift);
    };

    place();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isHome, phase]);

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
    const safety = window.setTimeout(finish, HOLD_MS + REVEAL_MS * 1000 + 1500);
    return () => window.clearTimeout(safety);
  }, [isHome, phase, finish]);

  useLayoutEffect(() => {
    if (phase !== "reveal") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      void animate(spinnerOpacity, 0, { duration: 0.15 });
      void animate(bgOpacity, 0, { duration: 0.2 }).then(finish);
      return;
    }

    void animate(spinnerOpacity, 0, { duration: 0.4, ease: EASE });
    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE });

    // Enable CSS transition, then set shift to 0 — browser does the sleek glide
    const el = getTarget();
    document.documentElement.dataset.splashPhase = "reveal";

    // Double rAF so the browser applies transition: before the value change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShift(0);
      });
    });

    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "transform") return;
      el?.removeEventListener("transitionend", onEnd);
      finish();
    };
    el?.addEventListener("transitionend", onEnd);

    const fallback = window.setTimeout(finish, REVEAL_MS * 1000 + 200);
    return () => {
      el?.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
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
