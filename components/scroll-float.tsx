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

/**
 * Animate per character, but wrap at word boundaries only.
 * Letter-level inline-blocks otherwise allow mid-word line breaks
 * (and NBSP between letters removed soft wrap opportunities at spaces).
 */
function splitChars(text: string, keyPrefix: string) {
  const tokens = text.split(/(\s+)/);
  return tokens.flatMap((token, tokenIndex) => {
    if (!token) return [];
    if (/^\s+$/.test(token)) {
      return [
        <span className="scroll-float-gap" key={`${keyPrefix}-g${tokenIndex}`}>
          {" "}
        </span>,
      ];
    }
    return [
      <span className="scroll-float-word" key={`${keyPrefix}-w${tokenIndex}`}>
        {token.split("").map((char, index) => (
          <span
            className="scroll-float-char"
            key={`${keyPrefix}-${tokenIndex}-${index}`}
          >
            {char}
          </span>
        ))}
      </span>,
    ];
  });
}

function visibleCharState() {
  return {
    opacity: 1,
    yPercent: 0,
    scaleY: 1,
    scaleX: 1,
    transformOrigin: "50% 0%",
  };
}

export default function ScrollFloat({
  children,
  lines,
  as: Tag = "h2",
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  // Linear scrub maps 1:1 to scroll — back.inOut hides the float mid-range.
  ease = "none",
  // Play while the title enters the viewport (not mostly off-screen).
  // React Bits' center/bottom+=50% → bottom/bottom-=40% finishes before you see it
  // on a tall landing page under a full-viewport hero.
  scrollStart = "top 92%",
  scrollEnd = "top 42%",
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

    const charElements = el.querySelectorAll<HTMLElement>(".scroll-float-char");
    if (!charElements.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      gsap.set(charElements, visibleCharState());
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
          immediateRender: true,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    }, el);

    const refresh = () => {
      ScrollTrigger.refresh();
    };

    // Framer Reveal / splash / fonts shift layout after first paint.
    const raf = window.requestAnimationFrame(refresh);
    const tQuick = window.setTimeout(refresh, 120);
    const tAfterReveal = window.setTimeout(refresh, 750);
    const tLate = window.setTimeout(refresh, 1600);
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
      window.clearTimeout(tLate);
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
