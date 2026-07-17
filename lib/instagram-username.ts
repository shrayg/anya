/** Client-safe Instagram username helpers (no Node/fs). */

export function normalizeInstagramUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i,
  );
  if (urlMatch?.[1]) {
    const segment = urlMatch[1].toLowerCase();
    if (
      ["p", "reel", "reels", "stories", "explore", "accounts"].includes(segment)
    ) {
      return null;
    }
    return urlMatch[1];
  }

  const normalized = trimmed.replace(/^@/, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
