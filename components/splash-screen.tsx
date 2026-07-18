"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

const HOLD_MS = 2000;
const REVEAL_MS = 0.95;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const TARGET_SEL = "[data-splash-target]";
const SPACER_SEL = "[data-splash-spacer]";

type Phase = "hold" | "reveal" | "done";

type Box = { left: number; top: number; width: number; height: number };

function getTarget() {
  return document.querySelector<HTMLElement>(TARGET_SEL);
}

function clearBrandStyles(el: HTMLElement) {
  el.style.position = "";
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
  el.style.margin = "";
  el.style.zIndex = "";
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.willChange = "";
  el.style.pointerEvents = "";
}

function removeSpacer() {
  document.querySelector(SPACER_SEL)?.remove();
}

function ensureSpacer(el: HTMLElement, box: Box) {
  let spacer = document.querySelector<HTMLElement>(SPACER_SEL);
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.dataset.splashSpacer = "";
    spacer.setAttribute("aria-hidden", "true");
    el.parentElement?.insertBefore(spacer, el);
  }
  spacer.style.width = `${box.width}px`;
  spacer.style.height = `${box.height}px`;
  spacer.style.flexShrink = "0";
  spacer.style.visibility = "hidden";
  spacer.style.pointerEvents = "none";
}

function measureNaturalBox(el: HTMLElement): Box {
  clearBrandStyles(el);
  removeSpacer();
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function pinBrand(el: HTMLElement, box: Box, scale: number, centered: boolean) {
  ensureSpacer(el, box);

  const left = centered
    ? window.innerWidth / 2 - box.width / 2
    : box.left;
  const top = centered
    ? window.innerHeight / 2 - box.height / 2
    : box.top;

  el.style.position = "fixed";
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${box.width}px`;
  el.style.margin = "0";
  el.style.zIndex = "110";
  el.style.transformOrigin = "center center";
  el.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  el.style.willChange = "transform, left, top";
  el.style.pointerEvents = "none";
}

/**
 * Home splash: black veil + spinner only.
 * Moves the homepage ShinyText node in place — never mounts a second wordmark.
 */
export const SplashScreen = () => {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const started = useRef(false);
  const naturalRef = useRef<Box | null>(null);
  const brandRef = useRef<HTMLElement | null>(null);
  const finishedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(() =>
    typeof window === "undefined" ? "hold" : pathname === "/" ? "hold" : "done",
  );

  const bgOpacity = useMotionValue(1);
  const spinnerOpacity = useMotionValue(1);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const el = brandRef.current ?? getTarget();
    if (el) clearBrandStyles(el);
    removeSpacer();
    delete document.documentElement.dataset.splash;
    document.documentElement.style.overflow = "";
    setPhase("done");
  }, []);

  useLayoutEffect(() => {
    if (!isHome) {
      setPhase("done");
      return;
    }

    finishedRef.current = false;
    document.documentElement.dataset.splash = "active";
    document.documentElement.style.overflow = "hidden";

    return () => {
      const el = brandRef.current ?? getTarget();
      if (el) clearBrandStyles(el);
      removeSpacer();
      delete document.documentElement.dataset.splash;
      document.documentElement.style.overflow = "";
    };
  }, [isHome]);

  // Pin the real homepage title to viewport center for the hold
  useLayoutEffect(() => {
    if (!isHome || phase !== "hold") return;

    let cancelled = false;
    let raf = 0;

    const pin = () => {
      if (cancelled) return;
      const el = getTarget();
      if (!el) {
        raf = requestAnimationFrame(pin);
        return;
      }

      brandRef.current = el;
      if (!naturalRef.current) {
        naturalRef.current = measureNaturalBox(el);
      }
      pinBrand(el, naturalRef.current, 1.12, true);
    };

    pin();
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

  // Move the same node from center → its layout slot, then release styles
  useLayoutEffect(() => {
    if (phase !== "reveal") return;

    const el = brandRef.current ?? getTarget();
    let natural = naturalRef.current;

    if (!el) {
      finish();
      return;
    }

    brandRef.current = el;
    if (!natural) {
      const box = measureNaturalBox(el);
      naturalRef.current = box;
      natural = box;
      pinBrand(el, box, 1.12, true);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      void animate(bgOpacity, 0, { duration: 0.2 });
      void animate(spinnerOpacity, 0, { duration: 0.15 });
      window.setTimeout(finish, 220);
      return;
    }

    const fromLeft = Number.parseFloat(el.style.left);
    const fromTop = Number.parseFloat(el.style.top);
    const toLeft = natural.left;
    const toTop = natural.top;

    void animate(spinnerOpacity, 0, { duration: 0.25, ease: EASE });
    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE });

    void Promise.all([
      animate(fromLeft, toLeft, {
        duration: REVEAL_MS,
        ease: EASE,
        onUpdate: (v) => {
          el.style.left = `${v}px`;
        },
      }),
      animate(fromTop, toTop, {
        duration: REVEAL_MS,
        ease: EASE,
        onUpdate: (v) => {
          el.style.top = `${v}px`;
        },
      }),
      animate(1.12, 1, {
        duration: REVEAL_MS,
        ease: EASE,
        onUpdate: (v) => {
          el.style.transform =
            Math.abs(v - 1) < 0.001 ? "none" : `scale(${v})`;
        },
      }),
    ]).then(finish);
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
