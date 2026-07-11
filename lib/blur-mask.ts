function stableHash(input: string): number {
  let hash = 2_166_136_261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function buildStableBlurMask(text: string, blurPercentage = 0.65): Set<number> {
  const chars = text.split("");
  const blurIndices = new Set<number>();
  const teaserCount = Math.min(2, Math.max(1, Math.floor(chars.length * 0.15)));
  const maxBlur = Math.max(0, chars.length - teaserCount);
  const targetBlur = Math.min(maxBlur, Math.ceil(chars.length * blurPercentage));

  const ranked = chars
    .map((char, index) => ({
      index,
      rank: stableHash(`${text}:${index}:${char}`),
      blurCandidate: Boolean(char.trim()),
    }))
    .filter((entry) => entry.blurCandidate)
    .sort((a, b) => a.rank - b.rank);

  for (let i = 0; i < targetBlur && i < ranked.length; i += 1) {
    blurIndices.add(ranked[i].index);
  }

  return blurIndices;
}
