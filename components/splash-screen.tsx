"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { usePathname } from "next/navigation";

const HOLD_MS = 1800;
const REVEAL_MS = 1.2;
const EASE: [number, number, number, number] = [0.45, 0.05, 0.25, 1];

type Phase = "hold" | "reveal" | "done";

function clearShift() {
  document.documentElement.style.removeProperty("--splash-shift");
}

/**
 * Splash veil + spinner. Homepage wordmark stays in place (no translate glide).
 * Reveal fades the veil; brand text is elevated via [data-splash-target] z-index.
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

    // The entrance veil is a first-load moment. Re-entering the home route in
    // the same app session must never re-lock the document after it has run.
    if (started.current) {
      setPhase("done");
      clearShift();
      delete document.documentElement.dataset.splash;
      delete document.documentElement.dataset.splashPhase;
      document.body.style.overflow = "";

      return;
    }

    finishedRef.current = false;
    document.documentElement.dataset.splash = "active";
    document.documentElement.dataset.splashPhase = "hold";
    document.body.style.overflow = "hidden";
    clearShift();

    return () => {
      clearShift();
      delete document.documentElement.dataset.splash;
      delete document.documentElement.dataset.splashPhase;
      document.body.style.overflow = "";
    };
  }, [isHome]);

  useEffect(() => {
    if (!isHome || phase !== "hold") return;
    if (started.current) return;
    started.current = true;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    document.documentElement.dataset.splashPhase = "reveal";

    if (reduced) {
      void animate(spinnerOpacity, 0, { duration: 0.15 });
      void animate(bgOpacity, 0, { duration: 0.2 }).then(finish);

      return;
    }

    void animate(spinnerOpacity, 0, { duration: 0.4, ease: EASE });
    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE }).then(
      finish,
    );
  }, [phase, bgOpacity, spinnerOpacity, finish]);

  if (!isHome || phase === "done") {
    return null;
  }

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: phase === "hold" ? "auto" : "none" }}
    >
      <motion.div
        className="absolute inset-0 bg-black"
        style={{ opacity: bgOpacity }}
      />

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
          aria-label="Loading"
          className="size-8 rounded-full border-2 border-white/20 border-t-white animate-spin"
          role="status"
        />
      </motion.div>
    </div>
  );
};
