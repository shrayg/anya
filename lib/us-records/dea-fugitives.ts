import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

function slugToName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function shouldSearchDeaFugitives(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return Boolean(parsed.firstName && parsed.lastName);
}

/**
 * DEA fugitives directory (public HTML).
 * Uses Drupal keys search so matches aren't limited to the first page of /all.
 */
export async function searchDeaFugitives(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) return [];

  const key = cacheKey("dea-fugitives", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const url =
    "https://www.dea.gov/fugitives?" +
    new URLSearchParams({ keys: needle }).toString();

  const html = await fetchUsRecordsText(url, {
    source: "dea-fugitives",
    minIntervalMs: 500,
    userAgent: BROWSER_UA,
    headers: { Referer: "https://www.dea.gov/fugitives" },
  });

  const slugs = [
    ...new Set(
      [...html.matchAll(/href="\/fugitives\/([a-z0-9\-]+)"/gi)]
        .map((m) => m[1]!)
        .filter((s) => s !== "all" && !s.includes(".")),
    ),
  ];

  const retrievedAt = new Date().toISOString();
  const hits = slugs
    .map((slug) => {
      const name = slugToName(slug);
      return { slug, name, score: scoreNameMatch(name, needle) };
    })
    .filter((row) => row.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ slug, name, score }) => ({
      id: `dea-${slug}`,
      name,
      kind: "wanted" as const,
      subtitle: "DEA fugitive",
      country: "US",
      details: [
        { label: "Agency", value: "DEA" },
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "dea-fugitives" as const,
        label: "DEA Fugitives",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: `https://www.dea.gov/fugitives/${slug}`,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["dea-fugitives"].ttlMs);
  return hits;
}
