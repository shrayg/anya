import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

const LIST_URL =
  "https://www.usmarshals.gov/what-we-do/fugitive-investigations/15-most-wanted-fugitive";

function slugToName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function shouldSearchUsmsWanted(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return (
    Boolean(parsed.firstName && parsed.lastName) ||
    /\b(usms|marshal|most\s*wanted|fugitive)\b/i.test(parsed.raw)
  );
}

/**
 * US Marshals 15 Most Wanted (+ related profile cards linked from the page).
 * Small curated list — name-matched against published profile URLs/slugs.
 */
export async function searchUsmsWanted(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) return [];

  const key = cacheKey("usms-wanted-v2", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const html = await fetchUsRecordsText(LIST_URL, {
    source: "usms-wanted",
    minIntervalMs: 500,
    userAgent: BROWSER_UA,
    headers: { Referer: "https://www.usmarshals.gov/" },
  });

  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const candidates: Array<{ name: string; href: string }> = [];

  for (const match of html.matchAll(
    /href="((?:https:\/\/www\.usmarshals\.gov)?(\/what-we-do\/fugitive[^"]*?\/([a-z0-9\-]+)))"/gi,
  )) {
    const full = match[1]!;
    const path = match[2]!;
    const slug = match[3]!;
    if (
      !/15-most-wanted|profiled-fugitives/i.test(path) ||
      /fugitive-investigations\/15-most-wanted-fugitive\/?$/i.test(path)
    ) {
      continue;
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    candidates.push({
      name: slugToName(slug),
      href: full.startsWith("http")
        ? full
        : `https://www.usmarshals.gov${path}`,
    });
  }

  // Prefer heading text when it scores better against the same slug-ish page.
  const headings = [
    ...html.matchAll(/<h[23][^>]*>\s*([^<]{4,80})\s*<\/h[23]>/gi),
  ]
    .map((m) => m[1]!.replace(/\s+/g, " ").trim())
    .filter((n) => !/most wanted|fugitive|united|search|about|menu/i.test(n));

  for (const heading of headings) {
    const existing = candidates.find(
      (c) => scoreNameMatch(c.name, heading) >= 70,
    );
    if (existing) {
      existing.name = heading;
    } else if (scoreNameMatch(heading, needle) >= 45) {
      candidates.push({ name: heading, href: LIST_URL });
    }
  }

  const hits = candidates
    .map((row) => ({
      ...row,
      score: scoreNameMatch(row.name, needle),
    }))
    .filter((row) => row.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ name, href, score }) => ({
      id: `usms-${name}`.slice(0, 180),
      name,
      kind: "wanted" as const,
      subtitle: "US Marshals most-wanted / profiled fugitive",
      country: "US",
      details: [
        { label: "Agency", value: "USMS" },
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "usms-wanted" as const,
        label: "US Marshals Most Wanted",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: href,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["usms-wanted"].ttlMs);
  return hits;
}
