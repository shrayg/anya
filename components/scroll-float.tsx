"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type ElementType,
  type RefObject,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import "./scroll-float.css";

export type ScrollFloatLine = string | { text: string; accent?: boolean };

type ScrollFloatProps = {
  children?: string;
  /** Multi-line titles; second+ lines can be marked accent (blush). */
  lines?: ScrollFloatLine[];
  as?: ElementType;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  /** When the block enters the viewport (GSAP start). */
  scrollStart?: string;
  stagger?: number;
};

function normalizeLines(
  children: string | undefined,
  lines: ScrollFloatLine[] | undefined,
): { text: string; accent: boolean }[] {
  if (lines?.length) {
    return lines.map((line) =>
      typeof line === "string"
        ? { text: line, accent: false }
        : { text: line.text, accent: Boolean(line.accent) },
    );
  }
  if (typeof children === "string") {
    return [{ text: children, accent: false }];
  }
  return [];
}

export default function ScrollFloat({
  children,
  lines,
  as: Tag = "h2",
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 0.55,
  ease = "power2.out",
  scrollStart = "top 88%",
  stagger = 0.08,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const linesKey =
    lines != null
      ? lines
          .map((line) =>
            typeof line === "string"
              ? line
              : `${line.text}\0${line.accent ? "1" : "0"}`,
          )
          .join("\n")
      : (children ?? "");

  const resolvedLines = useMemo(
    () => normalizeLines(children, lines),
    // Stabilize against inline array literals from parents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesKey],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || resolvedLines.length === 0) return;

    // Fade whole lines — never per-glyph inline-blocks. Splitting every letter
    // into inline-block + a sub-1 line-height was clipping ascenders/descenders.
    const lineElements = el.querySelectorAll<HTMLElement>(".scroll-float-line");
    if (!lineElements.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      gsap.set(lineElements, { opacity: 1 });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const scroller =
      scrollContainerRef?.current &&
      scrollContainerRef.current instanceof HTMLElement
        ? scrollContainerRef.current
        : window;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        lineElements,
        {
          willChange: "opacity",
          opacity: 0,
        },
        {
          duration: animationDuration,
          ease,
          opacity: 1,
          stagger,
          immediateRender: true,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            once: true,
            toggleActions: "play none none none",
            invalidateOnRefresh: true,
          },
        },
      );
    }, el);

    const refresh = () => {
      ScrollTrigger.refresh();
    };

    const raf = window.requestAnimationFrame(refresh);
    const tQuick = window.setTimeout(refresh, 120);
    const tAfterReveal = window.setTimeout(refresh, 750);
    void document.fonts?.ready?.then(refresh);

    const onSplashGone = () => {
      if (!document.documentElement.hasAttribute("data-splash")) refresh();
    };
    const splashObserver = new MutationObserver(onSplashGone);
    splashObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-splash"],
    });
    window.addEventListener("load", refresh);
    window.addEventListener("resize", refresh);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tQuick);
      window.clearTimeout(tAfterReveal);
      splashObserver.disconnect();
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
      ctx.revert();
    };
  }, [
    scrollContainerRef,
    animationDuration,
    ease,
    scrollStart,
    stagger,
    linesKey,
    resolvedLines.length,
  ]);

  if (resolvedLines.length === 0) return null;

  return (
    <Tag
      ref={containerRef as never}
      className={`scroll-float${containerClassName ? ` ${containerClassName}` : ""}`}
    >
      <span
        className={`scroll-float-text${textClassName ? ` ${textClassName}` : ""}`}
      >
        {resolvedLines.map((line, lineIndex) => (
          <span
            className={`scroll-float-line${line.accent ? " scroll-float-line--accent" : ""}`}
            key={`line-${lineIndex}`}
          >
            {line.text}
          </span>
        ))}
      </span>
    </Tag>
  );
}
