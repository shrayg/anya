"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";

type BrutalistRevealProps = PropsWithChildren<{
  className?: string;
  delay?: number;
}>;

export function BrutalistReveal({
  children,
  className = "",
  delay = 0,
}: BrutalistRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hasRendered = false;
    let cleanupTimer = 0;

    const render = () => {
      if (hasRendered) return;

      hasRendered = true;
      element.classList.add("is-rendering");
      element.animate(
        [
          {
            opacity: 0,
          },
          {
            opacity: 1,
          },
        ],
        {
          delay,
          duration: 550,
          easing: "ease-out",
          fill: "forwards",
        },
      );
      cleanupTimer = window.setTimeout(
        () => element.classList.remove("is-rendering"),
        delay + 600,
      );
    };

    if (!("IntersectionObserver" in window)) {
      render();

      return () => window.clearTimeout(cleanupTimer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        render();
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10%", threshold: 0.06 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      window.clearTimeout(cleanupTimer);
    };
  }, [delay]);

  return (
    <div ref={elementRef} className={`brutalist-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
