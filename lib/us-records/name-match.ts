/**
 * Shared name scoring for list-based public-record adapters.
 */
export function scoreNameMatch(haystack: string, needle: string): number {
  const h = haystack
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const n = needle
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!n || !h) return 0;
  if (h === n) return 100;
  if (n.length >= 4 && h.includes(n)) return 85;
  if (
    h.length >= 8 &&
    h.length >= Math.floor(n.length * 0.7) &&
    n.includes(h)
  ) {
    return 82;
  }
  const tokens = n.split(" ").filter((t) => t.length > 1);

  if (!tokens.length) return 0;
  const hTokens = h.split(" ").filter((t) => t.length > 1);

  if (!hTokens.length) return 0;
  const matched = tokens.filter((token) =>
    hTokens.some(
      (ht) =>
        ht === token ||
        (token.length >= 4 && ht.includes(token)) ||
        (ht.length >= 4 && token.includes(ht)),
    ),
  ).length;
  const last = tokens[tokens.length - 1]!;
  const lastHit = hTokens.some(
    (ht) => ht === last || (last.length >= 3 && ht.includes(last)),
  );

  if (matched === tokens.length && tokens.length >= 2) return lastHit ? 78 : 70;
  if (matched === tokens.length) return 65;
  if (matched >= 2 && lastHit) return 58;
  if (matched === 1 && lastHit && tokens.length >= 2) return 52;

  return Math.round((matched / tokens.length) * 45);
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);

  return out;
}

export function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function queryNeedle(parsed: {
  fullName?: string;
  lastName?: string;
  firstName?: string;
  raw: string;
}): string {
  return (
    parsed.fullName ||
    [parsed.firstName, parsed.lastName].filter(Boolean).join(" ") ||
    parsed.lastName ||
    parsed.raw
  ).trim();
}
