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

const HOLD_MS = 280;
const REVEAL_MS = 0.85;
const EASE: [number, number, number, number] = [0.45, 0.05, 0.25, 1];

type Phase = "hold" | "reveal" | "done";

/**
 * First-load home entrance: solid black veil that fades out so the page
 * appears from black. No spinner. Skipped on non-home routes and on later
 * client navigations back to home.
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

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    delete document.documentElement.dataset.splash;
    delete document.documentElement.dataset.splashPhase;
    document.body.style.overflow = "";
    setPhase("done");
  }, []);

  useLayoutEffect(() => {
    if (!isHome) {
      started.current = true;
      setPhase("done");

      return;
    }

    if (started.current) {
      setPhase("done");
      delete document.documentElement.dataset.splash;
      delete document.documentElement.dataset.splashPhase;
      document.body.style.overflow = "";

      return;
    }

    finishedRef.current = false;
    document.documentElement.dataset.splash = "active";
    document.documentElement.dataset.splashPhase = "hold";
    document.body.style.overflow = "hidden";

    return () => {
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
    const wait = reduced ? 80 : HOLD_MS;

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
      void animate(bgOpacity, 0, { duration: 0.2 }).then(finish);

      return;
    }

    void animate(bgOpacity, 0, { duration: REVEAL_MS, ease: EASE }).then(
      finish,
    );
  }, [phase, bgOpacity, finish]);

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
    </div>
  );
};
