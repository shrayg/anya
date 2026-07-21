import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

const SEARCH_URL =
  "https://webapps.doc.state.nc.us/opi/offendersearch.do?method=list";

export function shouldSearchNcDoc(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "NC") return false;
  if (parsed.state === "NC") return true;
  return /\bnorth carolina\b/i.test(parsed.raw);
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * North Carolina DPS Offender Public Information search (form POST).
 * Optional DOB filter when known.
 */
export async function searchNcDocInmate(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const last = (parsed.lastName || "").trim();
  const first = (parsed.firstName || "").trim();
  if (!last) {
    throw new Error(
      "NC DOC inmate search needs a last name (e.g. John Smith, NC).",
    );
  }

  const key = cacheKey(
    "nc-doc-v2",
    `${last}|${first}|${parsed.dob || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  await paceSource("nc-doc", 800);

  const body = new URLSearchParams({
    searchLastName: last.toUpperCase(),
    searchFirstName: first.toUpperCase(),
    searchMiddleName: "",
    searchSoundex: "false",
    searchOffenderId: "",
    searchGender: "",
    searchRace: "",
    ethnicity: "",
    searchDOB: parsed.dob || "",
    searchDOBRange: parsed.dob ? "0" : "0",
    ageMinimum: "",
    ageMaximum: "",
    heightTotalInchesMinimum: "",
    heightTotalInchesMaximum: "",
    activeFilter: "true",
  });

  const res = await fetchWithTimeout(SEARCH_URL, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["nc-doc"].timeoutMs,
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Origin: "https://webapps.doc.state.nc.us",
      Referer:
        "https://webapps.doc.state.nc.us/opi/offendersearch.do?method=view",
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`NC DOC HTTP ${res.status}`);
  const html = await res.text();
  const retrievedAt = new Date().toISOString();
  const needle = queryNeedle(parsed) || `${first} ${last}`.trim();

  const hits: PersonHit[] = [];
  const rowRe =
    /<tr class="tableRow(?:Odd|Even)">\s*<td[^>]*>\s*<a[^>]+href="([^"]*offenderID=(\d+)[^"]*)"[^>]*>\s*(\d+)\s*<\/a>\s*<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>/gi;

  for (const match of html.matchAll(rowRe)) {
    const href = match[1]!;
    const offenderId = match[2] || match[3] || "";
    const lastName = decode(match[4]!);
    const middleName = decode(match[5]!);
    const firstName = decode(match[6]!);
    const middleInitial = decode(match[7]!);
    const gender = decode(match[8]!);
    const race = decode(match[9]!);
    const dob = decode(match[10]!);
    const age = decode(match[11]!);
    const name = [firstName, middleName || middleInitial, lastName]
      .filter(Boolean)
      .join(" ");
    if (!name) continue;
    const score = scoreNameMatch(name, needle);
    if (score < 40) continue;
    if (parsed.dob && dob && !dob.includes(parsed.dob.slice(0, 5))) {
      // soft DOB cue only when formats align; keep hit otherwise
    }
    hits.push({
      id: `nc-doc-${offenderId || name}`.slice(0, 180),
      name,
      kind: "inmate",
      subtitle: [
        offenderId ? `#${offenderId}` : null,
        gender,
        age ? `Age ${age}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      state: "NC",
      country: "US",
      details: [
        ...(offenderId
          ? [{ label: "Offender ID", value: offenderId }]
          : []),
        ...(gender ? [{ label: "Gender", value: gender }] : []),
        ...(race ? [{ label: "Race", value: race }] : []),
        ...(dob ? [{ label: "DOB", value: dob }] : []),
        ...(age ? [{ label: "Age", value: age }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "nc-doc",
        label: "NC DPS Offender Search",
        jurisdiction: "North Carolina",
        retrievedAt,
        deepLink: href.startsWith("http")
          ? href
          : `https://webapps.doc.state.nc.us/opi/${href}`,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["nc-doc"].ttlMs);
  return hits;
}
