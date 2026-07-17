import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

/**
 * Pennsylvania UJS Portal Case Search — form POST twin (no separate JSON API).
 * ParticipantName requires a County value (e.g. "Philadelphia").
 */
const BASE = "https://ujsportal.pacourts.us";

const COUNTY_ALIASES: Record<string, string> = {
  philadelphia: "Philadelphia",
  philly: "Philadelphia",
  allegheny: "Allegheny",
  pittsburgh: "Allegheny",
  montgomery: "Montgomery",
  bucks: "Bucks",
  delaware: "Delaware",
  chester: "Chester",
  lancaster: "Lancaster",
  york: "York",
  berks: "Berks",
  lehigh: "Lehigh",
  northampton: "Northampton",
  erie: "Erie",
  dauphin: "Dauphin",
  harrisburg: "Dauphin",
};

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Pennsylvania UJS (e.g. John Smith, Philadelphia, PA).",
  );
}

function resolveCounty(parsed: ParsedUsQuery): string {
  const raw = (parsed.county || parsed.city || "").trim();
  if (!raw) {
    throw new Error(
      "Pennsylvania UJS participant search requires a county (e.g. John Smith, Philadelphia, PA).",
    );
  }
  const key = raw.toLowerCase().replace(/\s+county$/i, "").trim();
  return COUNTY_ALIASES[key] || raw.replace(/\s+county$/i, "").trim();
}

export function shouldSearchPaUjs(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state === "PA") return true;
  return /\b(pennsylvania|philadelphia|pittsburgh|harrisburg)\b/i.test(
    parsed.raw,
  );
}

function cookieHeader(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const parts =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  return parts.map((part) => part.split(";")[0]!).join("; ");
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

export async function searchPaUjs(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const county = resolveCounty(parsed);
  const key = cacheKey("pa-ujs", `${county}|${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("pa-ujs", 1500);

  const land = await fetchWithTimeout(`${BASE}/CaseSearch`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["pa-ujs"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });
  if (!land.ok) {
    throw new Error(`Pennsylvania UJS landing HTTP ${land.status}`);
  }
  const cookie = cookieHeader(land);
  const landHtml = await land.text();
  const token =
    landHtml.match(
      /name="__RequestVerificationToken"[^>]*value="([^"]+)"/,
    )?.[1] || "";
  if (!token) {
    throw new Error("Pennsylvania UJS antiforgery token missing.");
  }

  const body = new URLSearchParams({
    __RequestVerificationToken: token,
    SearchBy: "ParticipantName",
    ParticipantLastName: last,
    ParticipantFirstName: first,
    ParticipantDateOfBirth: "",
    County: county,
    AdvanceSearch: "false",
    btnSearch: "Search",
  });

  const res = await fetchWithTimeout(`${BASE}/CaseSearch`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["pa-ujs"].timeoutMs,
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/CaseSearch`,
      Origin: BASE,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Pennsylvania UJS HTTP ${res.status}`);
  }

  const html = await res.text();
  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = [];
  const seen = new Set<string>();

  // Result rows: hidden idxs, docket #, court type, caption, status, filed, party, dob, county, …
  const rowRe =
    /<tr[^>]*>([\s\S]*?href="(\/Report\/(?:Cp|Md|Mc|Aj)?DocketSheet\?docketNumber=([^"&]+)[^"]*)"[\s\S]*?)<\/tr>/gi;

  for (const match of html.matchAll(rowRe)) {
    const row = match[1] ?? "";
    const href = (match[2] ?? "").replace(/&amp;/g, "&");
    const docketFromLink = decodeURIComponent(match[3] ?? "").trim();
    if (!docketFromLink || seen.has(docketFromLink)) continue;
    seen.add(docketFromLink);

    const visible = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)]
      .filter((m) => !/display-none/i.test(m[1] ?? ""))
      .map((m) => decodeEntities((m[2] ?? "").replace(/<[^>]+>/g, " ")));

    const docket = visible[0] || docketFromLink;
    const courtType = visible[1] || "";
    const caption = visible[2] || docket;
    const status = visible[3] || "";
    const filed = visible[4] || "";
    const party = visible[5] || "";
    const rowCounty = visible[7] || county;
    const courtBits = [courtType, rowCounty].filter(Boolean);

    hits.push({
      id: `pa-ujs-${docket}`,
      caseName: caption,
      docketNumber: docket,
      court: courtBits.length
        ? `Pennsylvania · ${courtBits.join(" · ")}`
        : "Pennsylvania courts",
      dateFiled: filed || undefined,
      snippet: [status, party ? `Party: ${party}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      parties: party ? [party] : undefined,
      source: {
        id: "pa-ujs",
        label: "Pennsylvania UJS",
        jurisdiction: "Pennsylvania courts",
        retrievedAt,
        deepLink: href.startsWith("http") ? href : `${BASE}${href}`,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  // Fallback: collect unique docket links if row parse missed
  if (!hits.length) {
    for (const match of html.matchAll(
      /href="(\/Report\/[^"]*DocketSheet\?docketNumber=([^"&]+)[^"]*)"/gi,
    )) {
      const href = (match[1] ?? "").replace(/&amp;/g, "&");
      const docket = decodeURIComponent(match[2] ?? "").trim();
      if (!docket || seen.has(docket)) continue;
      seen.add(docket);
      hits.push({
        id: `pa-ujs-${docket}`,
        caseName: docket,
        docketNumber: docket,
        court: `Pennsylvania · ${county}`,
        source: {
          id: "pa-ujs",
          label: "Pennsylvania UJS",
          jurisdiction: "Pennsylvania courts",
          retrievedAt,
          deepLink: `${BASE}${href}`,
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, SOURCE_LIMITS["pa-ujs"].ttlMs);
  return hits;
}
