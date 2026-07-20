import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle } from "@/lib/us-records/name-match";
import { BROWSER_UA, SOURCE_LIMITS } from "@/lib/us-records/robots-and-limits";

async function loadGotScraping() {
  const mod = await import("got-scraping");

  return mod.gotScraping;
}

export function shouldSearchFlSunbiz(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "FL") return false;
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return false;
  if (parsed.state === "FL") return true;
  if (parsed.mode === "entity") return true;

  return /\b(llc|inc|corp|incorporated|sunbiz|florida)\b/i.test(parsed.raw);
}

/**
 * Florida Sunbiz entity search. Cloudflare blocks plain fetch; got-scraping clears it.
 */
export async function searchFlSunbiz(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];

  const key = cacheKey("fl-sunbiz", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const token = needle
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const order = token.replace(/\s+/g, "").toUpperCase();
  const url =
    `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/` +
    `${encodeURIComponent(token)}/Page1?searchNameOrder=${encodeURIComponent(order)}`;

  const gotScraping = await loadGotScraping();
  const res = await gotScraping({
    url,
    headerGeneratorOptions: {
      browsers: ["chrome"],
      operatingSystems: ["windows"],
    },
    headers: {
      Accept: "text/html",
      Referer: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
      "User-Agent": BROWSER_UA,
    },
    timeout: { request: SOURCE_LIMITS["fl-sunbiz"].timeoutMs },
  });

  if (res.statusCode >= 400) {
    throw new Error(`FL Sunbiz HTTP ${res.statusCode}`);
  }

  const html = res.body;
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(
    /CorporationSearch\/SearchResultDetail[^"]*"[^>]*>([^<]+)<\/a>[\s\S]{0,400}?>(Active|Inactive|Dissolved|Admin Dissolved|Converted|Merged)[^<]*</gi,
  )) {
    const name = (m[1] || "").replace(/\s+/g, " ").trim();
    const status = (m[2] || "").trim();

    if (!name || seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    hits.push({
      id: `fl-sunbiz-${name}`.slice(0, 180),
      name,
      kind: "business",
      subtitle: `Florida Sunbiz · ${status}`,
      state: "FL",
      country: "US",
      details: [
        { label: "Status", value: status },
        { label: "Source", value: "FL Division of Corporations" },
      ],
      source: {
        id: "fl-sunbiz",
        label: "Florida Sunbiz",
        jurisdiction: "Florida",
        retrievedAt,
        deepLink: url,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  if (!hits.length) {
    for (const m of html.matchAll(
      /CorporationSearch\/SearchResultDetail[^"]*"[^>]*>([^<]+)<\/a>/gi,
    )) {
      const name = (m[1] || "").replace(/\s+/g, " ").trim();

      if (!name || seen.has(name.toUpperCase())) continue;
      seen.add(name.toUpperCase());
      hits.push({
        id: `fl-sunbiz-${name}`.slice(0, 180),
        name,
        kind: "business",
        subtitle: "Florida Sunbiz entity",
        state: "FL",
        country: "US",
        details: [{ label: "Source", value: "FL Division of Corporations" }],
        source: {
          id: "fl-sunbiz",
          label: "Florida Sunbiz",
          jurisdiction: "Florida",
          retrievedAt,
          deepLink: url,
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, SOURCE_LIMITS["fl-sunbiz"].ttlMs);

  return hits;
}
