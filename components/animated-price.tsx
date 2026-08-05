"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedPriceProps {
  value: number;
  duration?: number;
  className?: string;
}

export default function AnimatedPrice({
  value,
  duration = 1.5,
  className,
}: AnimatedPriceProps) {
  return (
    <span className={className ?? "text-4xl font-bold text-white tabular-nums"}>
      $<AnimatedNumber decimals={2} duration={duration} value={value} />
    </span>
  );
}

export function AnimatedNumber({
  value,
  duration = 1.1,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const mounted = useRef(false);
  const motionValue = useMotionValue(value);
  const formatted = useTransform(motionValue, (latest) =>
    latest.toFixed(decimals),
  );

  useEffect(() => {
    // First paint shows the final value — only tween on later changes.
    if (!mounted.current) {
      mounted.current = true;
      motionValue.set(value);

      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    });

    return () => controls.stop();
  }, [value, motionValue, duration]);

  return <motion.span className={className}>{formatted}</motion.span>;
}
