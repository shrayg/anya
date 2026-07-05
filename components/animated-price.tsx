"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedPriceProps {
  value: number;
  duration?: number;
}

export default function AnimatedPrice({ value, duration = 1.5 }: AnimatedPriceProps) {
  return (
    <span className="text-4xl font-bold text-white tabular-nums">
      $<AnimatedNumber value={value} duration={duration} />
    </span>
  );
}

function AnimatedNumber({
  value,
  duration,
}: {
  value: number;
  duration: number;
}) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1], // slower easeOut
    });
  }, [value, motionValue, duration]);

  return <motion.span>{rounded}</motion.span>;
}
