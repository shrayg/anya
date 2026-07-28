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

gsap.registerPlugin(ScrollTrigger);

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
  scrollStart?: string;
  scrollEnd?: string;
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

function splitChars(text: string, keyPrefix: string) {
  return text.split("").map((char, index) => (
    <span className="scroll-float-char" key={`${keyPrefix}-${index}`}>
      {char === " " ? "\u00A0" : char}
    </span>
  ));
}

export default function ScrollFloat({
  children,
  lines,
  as: Tag = "h2",
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = "back.inOut(2)",
  scrollStart = "top bottom-=12%",
  scrollEnd = "center center+=8%",
  stagger = 0.03,
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

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const scroller = scrollContainerRef?.current ?? window;
    const charElements = el.querySelectorAll(".scroll-float-char");
    if (!charElements.length) return;

    const tween = gsap.fromTo(
      charElements,
      {
        willChange: "opacity, transform",
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: "50% 0%",
      },
      {
        duration: animationDuration,
        ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: true,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [
    scrollContainerRef,
    animationDuration,
    ease,
    scrollStart,
    scrollEnd,
    stagger,
    linesKey,
    resolvedLines.length,
  ]);

  if (resolvedLines.length === 0) return null;

  const multi = resolvedLines.length > 1;

  return (
    <Tag
      ref={containerRef as never}
      className={`scroll-float${containerClassName ? ` ${containerClassName}` : ""}`}
    >
      <span
        className={`scroll-float-text${textClassName ? ` ${textClassName}` : ""}`}
      >
        {resolvedLines.map((line, lineIndex) => {
          const chars = splitChars(line.text, `l${lineIndex}`);
          if (!multi && !line.accent) return chars;
          return (
            <span
              className={`scroll-float-line${line.accent ? " scroll-float-line--accent" : ""}`}
              key={`line-${lineIndex}`}
            >
              {chars}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}
