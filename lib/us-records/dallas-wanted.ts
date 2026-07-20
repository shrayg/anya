import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

const BASE = "https://www.dallascounty.org/dcwantedsearch";

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Dallas County wanted search (e.g. John Smith, TX).",
  );
}

export function shouldSearchDallasWanted(parsed: ParsedUsQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state === "TX") return true;

  return /\b(dallas|texas|tx)\b/i.test(parsed.raw);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchDallasWanted(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<PersonHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("dallas-wanted", `${last}|${first}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  await paceSource("dallas-wanted", 1000);

  const res = await fetchWithTimeout(`${BASE}/searchByName`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["dallas-wanted"].timeoutMs,
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Origin: "https://www.dallascounty.org",
      Referer: `${BASE}/search.jsp`,
    },
    body: new URLSearchParams({
      firstName: first,
      lastName: last,
      zipCode: parsed.zip || "",
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Dallas County wanted search HTTP ${res.status}`);
  }

  const html = await res.text();
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /href="defendant_detail\?dc=(\d+)"[^>]*>\s*([^<]+)<\/a><\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi,
  )) {
    const dc = match[1] ?? "";
    const name = decodeEntities(match[2] ?? "");
    const street = decodeEntities(match[3] ?? "");
    const city = decodeEntities(match[4] ?? "");
    const dob = decodeEntities(match[5] ?? "");
    const race = decodeEntities(match[6] ?? "");
    const sex = decodeEntities(match[7] ?? "");

    if (!dc || seen.has(dc)) continue;
    seen.add(dc);

    const address = [street, city].filter(Boolean).join(", ");

    hits.push({
      id: `dallas-wanted-${dc}`,
      name,
      kind: "wanted",
      subtitle: address || "Dallas County wanted / delinquent lookup",
      state: "TX",
      country: "US",
      details: [
        address ? { label: "Address", value: address } : null,
        dob ? { label: "DOB", value: dob } : null,
        race ? { label: "Race", value: race } : null,
        sex ? { label: "Sex", value: sex } : null,
        { label: "Record id", value: dc },
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      source: {
        id: "dallas-wanted",
        label: "Dallas County Wanted",
        jurisdiction: "Dallas County, Texas",
        retrievedAt,
        deepLink: `${BASE}/defendant_detail?dc=${dc}`,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  // Looser fallback if column layout differs
  if (!hits.length) {
    for (const match of html.matchAll(
      /href="defendant_detail\?dc=(\d+)"[^>]*>\s*([^<]+)<\/a>/gi,
    )) {
      const dc = match[1] ?? "";
      const name = decodeEntities(match[2] ?? "");

      if (!dc || seen.has(dc)) continue;
      seen.add(dc);
      hits.push({
        id: `dallas-wanted-${dc}`,
        name,
        kind: "wanted",
        subtitle: "Dallas County wanted / delinquent lookup",
        state: "TX",
        country: "US",
        details: [{ label: "Record id", value: dc }],
        source: {
          id: "dallas-wanted",
          label: "Dallas County Wanted",
          jurisdiction: "Dallas County, Texas",
          retrievedAt,
          deepLink: `${BASE}/defendant_detail?dc=${dc}`,
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, SOURCE_LIMITS["dallas-wanted"].ttlMs);

  return hits;
}
