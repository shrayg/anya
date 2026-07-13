export const DATING_APP_SLUGS = [
  "tinder",
  "bumble",
  "hinge",
  "match",
  "okcupid",
  "pof",
  "grindr",
  "badoo",
] as const;

export type DatingAppSlug = (typeof DATING_APP_SLUGS)[number];

const DATING_URL_RULES: { slug: DatingAppSlug; pattern: RegExp }[] = [
  { slug: "tinder", pattern: /(?:gotinder|tinder)\.com/i },
  { slug: "bumble", pattern: /bumble\.com/i },
  { slug: "hinge", pattern: /hinge\.co/i },
  { slug: "match", pattern: /match\.com/i },
  { slug: "okcupid", pattern: /okcupid\.com/i },
  { slug: "pof", pattern: /(?:pof|plentyoffish)\.com/i },
  { slug: "grindr", pattern: /grindr\.com/i },
  { slug: "badoo", pattern: /badoo\.com/i },
];

export function isDatingAppSlug(value: string): value is DatingAppSlug {
  return (DATING_APP_SLUGS as readonly string[]).includes(value);
}

export function detectDatingAppFromQuery(query: string): DatingAppSlug | null {
  const trimmed = query.trim();

  for (const rule of DATING_URL_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.slug;
    }
  }

  return null;
}

export function normalizeDatingQuery(query: string, slug?: DatingAppSlug | null): string {
  const trimmed = query.trim();
  const resolvedSlug = slug ?? detectDatingAppFromQuery(trimmed);

  if (!resolvedSlug) return trimmed;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);

    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];

    if (last) {
      return decodeURIComponent(last.replace(/^@/, ""));
    }
  } catch {
    // fall through
  }

  const handleMatch = trimmed.match(/@([A-Za-z0-9._-]+)/);
  if (handleMatch?.[1]) return handleMatch[1];

  return trimmed;
}
