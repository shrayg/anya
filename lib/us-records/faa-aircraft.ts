import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

export function shouldSearchFaaAircraft(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (/\bN\d{1,5}[A-Z]{0,2}\b/i.test(parsed.raw)) return true;
  return /\b(aircraft|airplane|faa|tail\s*number|n-number|avionics)\b/i.test(
    parsed.raw,
  );
}

/**
 * FAA Civil Aircraft Registry — name / N-number inquiry.
 * Registry search servers are intermittently unavailable (503); errors are surfaced.
 */
export async function searchFaaAircraft(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const nNumber = parsed.raw.match(/\b(N\d{1,5}[A-Z]{0,2})\b/i)?.[1];
  const needle = queryNeedle(parsed);
  if (!nNumber && (!needle || needle.length < 2)) return [];

  const key = cacheKey(
    "faa-aircraft",
    `${nNumber || ""}|${needle || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  await paceSource("faa-aircraft", 800);

  let url: string;
  if (nNumber) {
    url =
      "https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?" +
      new URLSearchParams({ NNumbertxt: nNumber.toUpperCase() }).toString();
  } else {
    url =
      "https://registry.faa.gov/aircraftinquiry/Search/NameInquiryResults?" +
      new URLSearchParams({
        nametxt: needle!.toUpperCase(),
        sort_option: "1",
        PageNo: "1",
      }).toString();
  }

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["faa-aircraft"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
      Referer: "https://registry.faa.gov/aircraftinquiry/Search/NameInquiry",
    },
  });

  if (res.status === 503) {
    throw new Error(
      "FAA aircraft registry search servers are temporarily unavailable (503).",
    );
  }
  if (!res.ok) throw new Error(`FAA registry HTTP ${res.status}`);

  const html = await res.text();
  if (/un-available|unavailable|apologies/i.test(html)) {
    throw new Error(
      "FAA aircraft registry search servers are temporarily unavailable.",
    );
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  // Name inquiry table rows often include N-Number + owner
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>\s*(?:<a[^>]*>)?\s*(N[0-9A-Z]+)\s*(?:<\/a>)?\s*<\/td>\s*<td[^>]*>\s*([^<]{2,80})\s*<\/td>/gi;
  for (const match of html.matchAll(rowRe)) {
    const n = match[1]!.toUpperCase();
    const owner = match[2]!.replace(/\s+/g, " ").trim();
    const score = needle ? scoreNameMatch(owner, needle) : 80;
    if (needle && score < 40) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    hits.push({
      id: `faa-${n}`,
      name: owner || n,
      kind: "other",
      subtitle: `Aircraft ${n}`,
      country: "US",
      details: [
        { label: "N-Number", value: n },
        ...(owner ? [{ label: "Owner / name", value: owner }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "faa-aircraft",
        label: "FAA Aircraft Registry",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: url,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  // N-number detail page: extract registrant
  if (hits.length === 0 && nNumber) {
    const ownerMatch = html.match(
      /(?:Name|Registrant)[^<]*<\/t[hd]>\s*<td[^>]*>\s*([^<]{2,100})/i,
    );
    if (ownerMatch) {
      hits.push({
        id: `faa-${nNumber.toUpperCase()}`,
        name: ownerMatch[1]!.replace(/\s+/g, " ").trim(),
        kind: "other",
        subtitle: `Aircraft ${nNumber.toUpperCase()}`,
        country: "US",
        details: [{ label: "N-Number", value: nNumber.toUpperCase() }],
        source: {
          id: "faa-aircraft",
          label: "FAA Aircraft Registry",
          jurisdiction: "United States",
          retrievedAt,
          deepLink: url,
          confidence: "high",
        },
      });
    }
  }

  setCached(key, hits, SOURCE_LIMITS["faa-aircraft"].ttlMs);
  return hits;
}
