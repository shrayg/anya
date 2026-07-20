"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import {
  useId,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type MouseEvent,
} from "react";

export type LiquidGlassBlurIntensity = "sm" | "md" | "lg" | "xl";
export type LiquidGlassGlowIntensity =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl";
export type LiquidGlassShadowIntensity = LiquidGlassGlowIntensity;

export type LiquidGlassCardProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "draggable"
> & {
  children: ReactNode;
  /** Enable free-form drag with elastic snap-back (off by default for panels). */
  draggable?: boolean;
  /** Click-to-expand size transition (ignores clicks on interactive children). */
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  blurIntensity?: LiquidGlassBlurIntensity;
  shadowIntensity?: LiquidGlassShadowIntensity;
  borderRadius?: string;
  glowIntensity?: LiquidGlassGlowIntensity;
};

/**
 * Frosted liquid-glass panel for dark UI (Anya-native).
 * API mirrors common community LiquidGlassCard props (ui-layouts / AstroAnimate).
 * Removable with `.liquid-glass-card*` CSS in globals.css.
 */
export function LiquidGlassCard({
  children,
  className,
  draggable = false,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = "sm",
  borderRadius = "12px",
  glowIntensity = "sm",
  shadowIntensity = "sm",
  style,
  onClick,
  ...props
}: LiquidGlassCardProps) {
  const reactId = useId();
  const filterId = `liquid-glass-card-${reactId.replace(/:/g, "")}`;
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpansion = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !expandable) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a, button, input, select, textarea, label")) return;
    setIsExpanded((open) => !open);
  };

  const sizeStyle: CSSProperties = {
    borderRadius,
    ...(width && !expandable ? { width } : null),
    ...(height && !expandable ? { height } : null),
    ...style,
  };

  const sharedClassName = clsx(
    "liquid-glass-card",
    `liquid-glass-card--blur-${blurIntensity}`,
    `liquid-glass-card--glow-${glowIntensity}`,
    `liquid-glass-card--shadow-${shadowIntensity}`,
    draggable && "liquid-glass-card--draggable",
    expandable && "liquid-glass-card--expandable",
    className,
  );

  const layers = (
    <>
      <div
        aria-hidden
        className="liquid-glass-card__bend"
        style={{
          borderRadius,
          ["--liquid-glass-card-filter" as string]: `url(#${filterId})`,
        }}
      />
      <div
        aria-hidden
        className="liquid-glass-card__face"
        style={{ borderRadius }}
      />
      <div
        aria-hidden
        className="liquid-glass-card__edge"
        style={{ borderRadius }}
      />
      <div className="liquid-glass-card__content">{children}</div>
      <svg
        aria-hidden
        className="liquid-glass-card__filter"
        focusable="false"
      >
        <defs>
          <filter
            colorInterpolationFilters="sRGB"
            filterUnits="objectBoundingBox"
            height="100%"
            id={filterId}
            width="100%"
            x="0"
            y="0"
          >
            <feTurbulence
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
              type="fractalNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="48"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
    </>
  );

  if (!draggable && !expandable) {
    return (
      <div className={sharedClassName} style={sizeStyle} {...props}>
        {layers}
      </div>
    );
  }

  return (
    <motion.div
      animate={
        expandable ? (isExpanded ? "expanded" : "collapsed") : undefined
      }
      className={sharedClassName}
      drag={draggable || false}
      dragConstraints={
        draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined
      }
      dragElastic={draggable ? 0.3 : undefined}
      dragTransition={
        draggable
          ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 }
          : undefined
      }
      style={sizeStyle}
      variants={
        expandable
          ? {
              collapsed: {
                width: width || "auto",
                height: height || "auto",
                transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
              },
              expanded: {
                width: expandedWidth || width || "auto",
                height: expandedHeight || height || "auto",
                transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
              },
            }
          : undefined
      }
      whileDrag={draggable ? { scale: 1.02 } : undefined}
      whileHover={draggable || expandable ? { scale: 1.01 } : undefined}
      whileTap={draggable || expandable ? { scale: 0.98 } : undefined}
      {...props}
      onClick={expandable ? handleToggleExpansion : onClick}
    >
      {layers}
    </motion.div>
  );
}
