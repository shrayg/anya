"use client";

import clsx from "clsx";
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";

export type LiquidButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Prefer CSS glass when SVG backdrop filters are unsupported / too heavy. */
  variant?: "liquid" | "glass";
};

/**
 * Apple-like liquid / CSS glass CTAs for dark surfaces.
 * Unique SVG filter IDs per instance; look does not depend on SVG displacement.
 */
export const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(
  function LiquidButton(
    {
      className,
      children,
      variant = "liquid",
      type = "button",
      style,
      disabled,
      ...props
    },
    ref,
  ) {
    const reactId = useId();
    const filterId = `container-glass-${reactId.replace(/:/g, "")}`;

    if (variant === "glass") {
      return (
        <button
          ref={ref}
          className={clsx("glass-button", className)}
          disabled={disabled}
          style={style}
          type={type}
          {...props}
        >
          <span aria-hidden className="glass-button__shine" />
          <span className="glass-button__label">{children}</span>
        </button>
      );
    }

    const liquidStyle = {
      ...style,
      ["--liquid-glass-filter" as string]: `url(#${filterId})`,
    } as CSSProperties;

    return (
      <button
        ref={ref}
        className={clsx("liquid-glass-button", className)}
        disabled={disabled}
        style={liquidStyle}
        type={type}
        {...props}
      >
        <span aria-hidden className="liquid-glass-button__glass" />
        <span aria-hidden className="liquid-glass-button__shine" />
        <span className="liquid-glass-button__label">{children}</span>
        <svg
          aria-hidden
          className="liquid-glass-button__filter"
          focusable="false"
        >
          <defs>
            <filter
              colorInterpolationFilters="sRGB"
              filterUnits="objectBoundingBox"
              height="140%"
              id={filterId}
              width="140%"
              x="-20%"
              y="-20%"
            >
              <feTurbulence
                baseFrequency="0.015 0.03"
                numOctaves="1"
                result="noise"
                seed="2"
                type="fractalNoise"
              />
              <feGaussianBlur
                in="noise"
                result="blurred"
                stdDeviation="0.8"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="blurred"
                scale="4"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      </button>
    );
  },
);

LiquidButton.displayName = "LiquidButton";
