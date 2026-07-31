"use client";

import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import {
  SpecularButton,
} from "@/components/ui/specular-button";

export type LiquidButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * @deprecated Prefer Specular primary CTAs. Kept for call-site compatibility.
   * `liquid` and `glass` both render SpecularButton (Anya ice-blue rim).
   */
  variant?: "liquid" | "glass";
};

/**
 * Primary CTA button — Specular rim light (React Bits), Anya ice-blue branding.
 * Preserves submit/disabled/loading behavior via native button attrs.
 */
export const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(
  function LiquidButton(
    {
      className,
      children,
      variant: _variant = "liquid",
      type = "button",
      ...props
    },
    ref,
  ) {
    const accent =
      typeof className === "string" &&
      className.includes("liquid-glass-button--accent");

    return (
      <SpecularButton
        ref={ref}
        accent={accent}
        className={clsx(className)}
        size="md"
        type={type}
        {...props}
      >
        {children}
      </SpecularButton>
    );
  },
);

LiquidButton.displayName = "LiquidButton";
