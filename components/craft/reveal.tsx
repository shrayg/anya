"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  ...props
}: RevealProps) {
  return (
    <motion.div
      className={clsx(className)}
      initial={{ opacity: 0, y }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      viewport={{ once: true, margin: "-8% 0px" }}
      whileInView={{ opacity: 1, y: 0 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
