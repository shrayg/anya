"use client";

import { useMemo } from "react";

import { buildStableBlurMask } from "@/lib/blur-mask";

export function BlurredValue({
  text,
  blurPercentage = 0.65,
  forceBlur = false,
}: {
  text: string;
  blurPercentage?: number;
  forceBlur?: boolean;
}) {
  const blurIndices = useMemo(
    () => (forceBlur ? buildStableBlurMask(text, blurPercentage) : null),
    [blurPercentage, forceBlur, text],
  );

  if (!forceBlur || !blurIndices) {
    return <span>{text}</span>;
  }

  const chars = text.split("");

  return (
    <span className="blur-value-wrap">
      {chars.map((char, index) => {
        const blurred = blurIndices.has(index);

        return (
          <span
            key={`${index}-${char}`}
            className={blurred ? "blur-value-char" : undefined}
          >
            {blurred ? "█" : char}
          </span>
        );
      })}
    </span>
  );
}
