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
  el.style.right = "";
  el.style.bottom = "";
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
  spacer.style.width = `${Math.max(box.width, 1)}px`;
  spacer.style.height = `${Math.max(box.height, 1)}px`;
  spacer.style.flexShrink = "0";
  spacer.style.visibility = "hidden";
  spacer.style.pointerEvents = "none";
}

function measureNaturalBox(el: HTMLElement): Box {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function pinCentered(el: HTMLElement, scale: number) {
  // Viewport-centered without forcing width (forced 0-width was killing the glyphs)
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.top = "50%";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = "auto";
  el.style.height = "auto";
  el.style.margin = "0";
  el.style.zIndex = "110";
  el.style.transformOrigin = "center center";
  el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  el.style.willChange = "transform, left, top";
  el.style.pointerEvents = "none";
}

function pinAtBox(el: HTMLElement, box: Box, scale: number) {
  el.style.position = "fixed";
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = "auto";
  el.style.height = "auto";
  el.style.margin = "0";
  el.style.zIndex = "110";
  el.style.transformOrigin = "center center";
  el.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  el.style.willChange = "transform, left, top";
  el.style.pointerEvents = "none";
}

/**
 * Home splash: black veil + spinner only.
 * Animates the homepage ShinyText node in place — never mounts a second wordmark.
 *
 * Requires the home hero section NOT to create a lower stacking context (no z-index),
 * otherwise position:fixed on the title stays trapped under the veil.
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

  const releaseBrand = useCallback(() => {
    const el = brandRef.current ?? getTarget();
    if (el) clearBrandStyles(el);
    removeSpacer();
    brandRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    releaseBrand();
    delete document.documentElement.dataset.splash;
    document.body.style.overflow = "";
    setPhase("done");
  }, [releaseBrand]);

  useLayoutEffect(() => {
    if (!isHome) {
      setPhase("done");
      return;
    }

    finishedRef.current = false;
    document.documentElement.dataset.splash = "active";
    document.body.style.overflow = "hidden";

    return () => {
      releaseBrand();
      delete document.documentElement.dataset.splash;
      document.body.style.overflow = "";
    };
  }, [isHome, releaseBrand]);

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

      const box = measureNaturalBox(el);
      if (box.width < 8 || box.height < 8) {
        raf = requestAnimationFrame(pin);
        return;
      }

      brandRef.current = el;
      naturalRef.current = box;
      ensureSpacer(el, box);
      pinCentered(el, 1.12);
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

  useLayoutEffect(() => {
    if (phase !== "reveal") return;

    const el = brandRef.current ?? getTarget();
    if (!el) {
      finish();
      return;
    }

    brandRef.current = el;

    const spacer = document.querySelector<HTMLElement>(SPACER_SEL);
    const spacerRect = spacer?.getBoundingClientRect();
    const natural =
      (spacerRect
        ? {
            left: spacerRect.left,
            top: spacerRect.top,
            width: spacerRect.width,
            height: spacerRect.height,
          }
        : null) ??
      naturalRef.current ?? {
        left: window.innerWidth / 2 - 120,
        top: Math.max(120, window.innerHeight * 0.28),
        width: 240,
        height: 80,
      };

    naturalRef.current = natural;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      void animate(bgOpacity, 0, { duration: 0.2 });
      void animate(spinnerOpacity, 0, { duration: 0.15 });
      window.setTimeout(finish, 220);
      return;
    }

    const fromRect = el.getBoundingClientRect();
    pinAtBox(
      el,
      {
        left: fromRect.left,
        top: fromRect.top,
        width: fromRect.width,
        height: fromRect.height,
      },
      1.12,
    );

    void animate(spinnerOpacity, 0, { duration: 0.25, ease: EASE });
    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE });

    void Promise.all([
      animate(fromRect.left, natural.left, {
        duration: REVEAL_MS,
        ease: EASE,
        onUpdate: (v) => {
          el.style.left = `${v}px`;
        },
      }),
      animate(fromRect.top, natural.top, {
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
