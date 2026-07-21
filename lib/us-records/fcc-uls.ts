import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

export function shouldSearchFccUls(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return /\b(fcc|uls|call\s*sign|ham\s*radio|amateur\s*radio|broadcast\s*license)\b/i.test(
    parsed.raw,
  );
}

async function loadGotScraping() {
  const mod = await import("got-scraping");
  return mod.gotScraping;
}

/**
 * FCC Universal Licensing System — name search via ULS results page.
 * Optional state filter when known.
 */
export async function searchFccUls(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) return [];

  const key = cacheKey(
    "fcc-uls-v2",
    `${needle}|${parsed.state || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const gotScraping = await loadGotScraping();
  // Warm the license search form (cookie/session), then POST results.
  await gotScraping({
    url: "https://wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp",
    headerGeneratorOptions: {
      browsers: ["chrome"],
      operatingSystems: ["windows"],
    },
    headers: { "User-Agent": BROWSER_UA },
    timeout: { request: SOURCE_LIMITS["fcc-uls"].timeoutMs },
  });

  const res = await gotScraping({
    url: "https://wireless2.fcc.gov/UlsApp/UlsSearch/results.jsp",
    method: "POST",
    form: {
      fiUlsSearchByType: "uls_l_name",
      fiUlsSearchByValue: needle.toUpperCase(),
      fiUlsExactMatchInd: "N",
      jsValidated: "true",
      Submit: "Submit",
      ...(parsed.state ? { fiStateCode: parsed.state.toUpperCase() } : {}),
    },
    headerGeneratorOptions: {
      browsers: ["chrome"],
      operatingSystems: ["windows"],
    },
    headers: {
      Accept: "text/html",
      Origin: "https://wireless2.fcc.gov",
      Referer: "https://wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp",
      "User-Agent": BROWSER_UA,
    },
    timeout: { request: SOURCE_LIMITS["fcc-uls"].timeoutMs },
  });

  if (res.statusCode >= 400) {
    throw new Error(`FCC ULS HTTP ${res.statusCode}`);
  }

  const html = String(res.body);
  // If ULS bounced us back to the search form, automation is blocked.
  if (
    /fiUlsSearchByType|Please enter search criteria|licenseSearch/i.test(html) &&
    !/matches found|Licensee Name|Call Sign/i.test(html)
  ) {
    throw new Error(
      "FCC ULS returned the search form instead of results (session/WAF still blocking automation).",
    );
  }
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  // Typical ULS result: license links + licensee name cells
  const rowRe =
    /href="([^"]*license\.jsp[^"]*)"[^>]*>\s*([^<]{1,40})\s*<\/a>[\s\S]{0,500}?<td[^>]*>\s*([^<]{2,100})\s*<\/td>/gi;

  for (const match of html.matchAll(rowRe)) {
    const href = match[1]!;
    const callOrId = match[2]!.replace(/\s+/g, " ").trim();
    const owner = match[3]!.replace(/\s+/g, " ").trim();
    const score = scoreNameMatch(owner, needle);
    if (score < 40) continue;
    const id = `${callOrId}-${owner}`.slice(0, 120);
    if (seen.has(id)) continue;
    seen.add(id);
    hits.push({
      id: `fcc-uls-${id}`,
      name: owner,
      kind: "other",
      subtitle: `FCC license ${callOrId}`,
      state: parsed.state,
      country: "US",
      details: [
        { label: "Call / license", value: callOrId },
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "fcc-uls",
        label: "FCC ULS Licenses",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: href.startsWith("http")
          ? href
          : `https://wireless2.fcc.gov${href.startsWith("/") ? "" : "/"}${href}`,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  // Fallback: scrape licensee-looking cells
  if (hits.length === 0) {
    const cellRe = /<td[^>]*>\s*([A-Z0-9][A-Za-z0-9 .,'&\-]{2,80})\s*<\/td>/g;
    for (const match of html.matchAll(cellRe)) {
      const name = match[1]!.replace(/\s+/g, " ").trim();
      const score = scoreNameMatch(name, needle);
      if (score < 55) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      hits.push({
        id: `fcc-uls-${name}`.slice(0, 180),
        name,
        kind: "other",
        subtitle: "FCC ULS match",
        state: parsed.state,
        country: "US",
        details: [{ label: "Match score", value: String(score) }],
        source: {
          id: "fcc-uls",
          label: "FCC ULS Licenses",
          jurisdiction: "United States",
          retrievedAt,
          deepLink:
            "https://wireless2.fcc.gov/UlsApp/UlsSearch/searchAdvanced.jsp",
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  if (hits.length === 0 && /no licenses|no records|0 results/i.test(html)) {
    setCached(key, [], SOURCE_LIMITS["fcc-uls"].ttlMs);
    return [];
  }

  if (hits.length === 0) {
    // ULS often requires a session cookie from the advanced search form.
    throw new Error(
      "FCC ULS search returned no parseable licenses (session/layout may block automated queries).",
    );
  }

  setCached(key, hits, SOURCE_LIMITS["fcc-uls"].ttlMs);
  return hits;
}
