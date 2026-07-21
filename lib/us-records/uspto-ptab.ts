import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

type PtabDecision = {
  proceedingNumber?: string;
  appellantName?: string;
  patentOwnerName?: string;
  documentTitle?: string;
  documentDate?: string;
  documentTypeCategory?: string;
};

type PtabResponse = {
  count?: number;
  results?: PtabDecision[];
};

/**
 * USPTO PTAB / IP signal.
 * Official ODP/TSDR now require USPTO.gov API keys — until configured,
 * this adapter attempts the public developer catalog and fails soft.
 */
export async function searchUsptoPtab(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) return [];

  const key = cacheKey("uspto-ptab", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  // Prefer env key when present (ODP).
  const apiKey = process.env.USPTO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "USPTO ODP/TSDR now require an API key (USPTO_API_KEY). Set one from account.uspto.gov/api-manager to enable PTAB/patent lookups.",
    );
  }

  const gotScraping = (await import("got-scraping")).gotScraping;
  const url =
    "https://data.uspto.gov/apis/ptab-trials/search-proceedings?" +
    new URLSearchParams({
      patentOwnerName: needle,
      start: "0",
      rows: String(Math.min(limit * 2, 20)),
    }).toString();

  const res = await gotScraping({
    url,
    responseType: "json",
    headerGeneratorOptions: {
      browsers: ["chrome"],
      operatingSystems: ["windows"],
    },
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      "X-API-KEY": apiKey,
    },
    timeout: { request: SOURCE_LIMITS["uspto-ptab"].timeoutMs },
  });

  if (res.statusCode >= 400) {
    throw new Error(`USPTO PTAB HTTP ${res.statusCode}`);
  }

  const data = res.body as PtabResponse;
  const retrievedAt = new Date().toISOString();
  const hits = (data.results || [])
    .map((row) => {
      const name = row.patentOwnerName || row.appellantName || "";
      return { row, name, score: scoreNameMatch(name, needle) };
    })
    .filter((r) => r.name && r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, name, score }) => ({
      id: `uspto-ptab-${row.proceedingNumber || name}`.slice(0, 180),
      name,
      kind: "other" as const,
      subtitle: [row.documentTypeCategory, row.proceedingNumber]
        .filter(Boolean)
        .join(" · "),
      country: "US",
      details: [
        ...(row.proceedingNumber
          ? [{ label: "Proceeding", value: row.proceedingNumber }]
          : []),
        ...(row.documentTitle
          ? [{ label: "Title", value: row.documentTitle }]
          : []),
        ...(row.documentDate
          ? [{ label: "Date", value: row.documentDate }]
          : []),
        ...(row.appellantName
          ? [{ label: "Appellant", value: row.appellantName }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "uspto-ptab" as const,
        label: "USPTO PTAB Decisions",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: "https://developer.uspto.gov/api-catalog/ptab-api-v2",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["uspto-ptab"].ttlMs);
  return hits;
}

export function shouldSearchUsptoPtab(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return /\b(uspto|patent|ptab|trademark|ipr\b|inter\s*partes)\b/i.test(
    parsed.raw,
  );
}
