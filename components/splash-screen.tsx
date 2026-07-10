"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";

const Sprinkle = ({ delay, index }: { delay: number; index: number }) => {
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const distance = 150 + ((index * 29) % 100);
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0 }}
      animate={{ opacity: 0, x, y }}
      transition={{ duration: 1, delay, ease: "easeOut" }}
      className="absolute h-2 w-2 rounded-full splash-sprinkle"
      style={{
        backgroundColor: "var(--anya-blush)",
        boxShadow: "0 0 10px var(--anya-blush-glow)",
      }}
    />
  );
};

export const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-black/40 pointer-events-none"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <Sprinkle key={i} delay={i * 0.05} index={i} />
      ))}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10"
      >
        <motion.div
          animate={{ rotate: [10, 25, 10] }}
          transition={{ duration: 3, ease: "easeInOut" }}
        >
          <Image
            src={siteLogoSrc}
            alt={siteConfig.name}
            width={80}
            height={80}
            unoptimized
            className={siteLogoClassName}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
