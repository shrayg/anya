"use client";

export function BlurredValue({
  text,
  blurPercentage = 0.65,
  forceBlur = false,
}: {
  text: string;
  blurPercentage?: number;
  forceBlur?: boolean;
}) {
  if (!forceBlur) {
    return <span>{text}</span>;
  }

  const chars = text.split("");
  const blurCount = Math.ceil(chars.length * blurPercentage);
  const blurIndices = new Set<number>();
  const unblurCount = Math.min(2, Math.max(1, Math.floor(chars.length * 0.15)));

  while (blurIndices.size < blurCount && blurIndices.size < chars.length - unblurCount) {
    blurIndices.add(Math.floor(Math.random() * chars.length));
  }

  const unblurIndices = new Set<number>();

  for (let i = 0; i < chars.length && unblurIndices.size < unblurCount; i += 1) {
    if (!blurIndices.has(i) && chars[i]?.trim()) {
      unblurIndices.add(i);
    }
  }

  return (
    <span className="blur-value-wrap">
      {chars.map((char, index) => {
        const blurred = blurIndices.has(index) && !unblurIndices.has(index);

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
