"use client";

import { buildMaskedTeaser } from "@/lib/blur-mask";

export function BlurredValue({
  text,
  forceBlur = false,
}: {
  text: string;
  /** @deprecated Kept for call-site compatibility; forced blur always fully masks. */
  blurPercentage?: number;
  forceBlur?: boolean;
}) {
  if (!forceBlur) {
    return <span>{text}</span>;
  }

  return (
    <span className="blur-value-wrap">
      <span className="blur-value-char">{buildMaskedTeaser(text)}</span>
    </span>
  );
}
