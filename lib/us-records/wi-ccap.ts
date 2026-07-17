import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

/**
 * Wisconsin CCAP party search via /jsonPost/caseSearch — twin of the SPA
 * submitPath "caseSearch" (bot-gated /api/* returns 403).
 */
const BASE = "https://wcca.wicourts.gov";

type WiCaseRow = {
  partyName?: string;
  countyName?: string;
  countyNo?: number;
  caseNo?: string;
  caption?: string;
  status?: string;
  filingDate?: string;
  dob?: string | null;
};

type WiSearchResponse = {
  result?: { cases?: WiCaseRow[] };
};

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Wisconsin CCAP (e.g. John Smith, WI).",
  );
}

export function shouldSearchWiCcap(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state === "WI") return true;
  return /\b(wisconsin|milwaukee|madison|green bay|ccap)\b/i.test(parsed.raw);
}

function cookieHeader(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const parts =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  return parts.map((part) => part.split(";")[0]!).join("; ");
}

export async function searchWiCcap(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("wi-ccap", `${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("wi-ccap", 1200);

  const land = await fetchWithTimeout(`${BASE}/`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["wi-ccap"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });
  if (!land.ok) {
    throw new Error(`Wisconsin CCAP landing HTTP ${land.status}`);
  }
  const cookie = cookieHeader(land);

  const res = await fetchWithTimeout(`${BASE}/jsonPost/caseSearch`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["wi-ccap"].timeoutMs,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/case.html`,
      Origin: BASE,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      lastName: last,
      firstName: first,
      middleName: "",
      countyNo: "",
      caseNo: "",
      businessName: "",
      dateOfBirth: "",
      includeMissingDob: true,
      includeMissingMiddleName: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Wisconsin CCAP HTTP ${res.status}`);
  }

  const json = (await res.json()) as WiSearchResponse;
  const rows = json.result?.cases ?? [];
  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const caseNo = row.caseNo?.trim();
    if (!caseNo) continue;
    const id = `${row.countyNo ?? "x"}-${caseNo}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const party = row.partyName?.trim();
    const caption = row.caption?.trim() || caseNo;
    const deepLink =
      row.countyNo != null
        ? `${BASE}/caseDetail.html?caseNo=${encodeURIComponent(caseNo)}&countyNo=${row.countyNo}`
        : `${BASE}/case.html`;

    hits.push({
      id: `wi-ccap-${id}`,
      caseName: caption,
      docketNumber: caseNo,
      court: row.countyName
        ? `Wisconsin · ${row.countyName} County`
        : "Wisconsin circuit courts",
      dateFiled: row.filingDate || undefined,
      snippet: [row.status, party ? `Party: ${party}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      parties: party ? [party] : undefined,
      source: {
        id: "wi-ccap",
        label: "Wisconsin CCAP",
        jurisdiction: "Wisconsin circuit courts",
        retrievedAt,
        deepLink,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["wi-ccap"].ttlMs);
  return hits;
}
