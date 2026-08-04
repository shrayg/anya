"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";

import { hasLeftHomeThisSession } from "@/components/craft/marketing-nav-beacon";

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode;
  delay?: number;
  /** Kept for call-site compatibility; motion is fade-only (no slide). */
  y?: number;
  /**
   * `inView` — animate when scrolled into view (Status / Support / Pricing).
   * `mount` — animate on mount when enabled (Home return visit).
   */
  mode?: "inView" | "mount";
  /** When false, render children with no enter animation. */
  enabled?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  y: _y = 0,
  mode = "inView",
  enabled = true,
  ...props
}: RevealProps) {
  void _y;

  if (!enabled) {
    return <div className={clsx(className)}>{children}</div>;
  }

  const transition = {
    duration: 0.55,
    ease: EASE,
    delay,
  };

  if (mode === "mount") {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className={clsx("overflow-visible", className)}
        initial={{ opacity: 0 }}
        style={{ overflow: "visible" }}
        transition={transition}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={clsx("overflow-visible", className)}
      initial={{ opacity: 0 }}
      style={{ overflow: "visible" }}
      transition={transition}
      viewport={{ once: true, margin: "-8% 0px" }}
      whileInView={{ opacity: 1 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Home enter animation only after the user left Home earlier in this session
 * (e.g. Pricing → Home). Cold open / first landing stays static so splash +
 * brand handoff is undisturbed.
 */
export function HomeReturnReveal({
  children,
  className,
  delay = 0,
  y: _y = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  void _y;
  // pending → decide before paint; skip = first landing; run = return visit
  const [phase, setPhase] = useState<"pending" | "skip" | "run">("pending");

  useLayoutEffect(() => {
    setPhase(hasLeftHomeThisSession() ? "run" : "skip");
  }, []);

  if (phase !== "run") {
    return <div className={clsx(className)}>{children}</div>;
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className={clsx(className)}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
