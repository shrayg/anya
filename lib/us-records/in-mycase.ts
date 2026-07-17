import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

/**
 * Indiana MyCase party search via /mycase/Search/SearchCases.
 * SPA is gated; the JSON twin accepts Mode/First/Last without captcha.
 */
const BASE = "https://public.courts.in.gov/mycase";
const LANDING = "https://public.courts.in.gov/MyCase";

type InCaseRow = {
  CaseID?: number;
  CaseToken?: string;
  CaseNumber?: string;
  CountyCode?: string;
  CourtCode?: string;
  Court?: string;
  FileDate?: string;
  CaseStatus?: string;
  CaseType?: string;
  Style?: string;
};

type InSearchResponse = {
  TotalResults?: number;
  Results?: InCaseRow[];
  Result?: { TotalResults?: number; Results?: InCaseRow[] };
};

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Indiana MyCase (e.g. James Williams, IN).",
  );
}

export function shouldSearchInMycase(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state === "IN") return true;
  return /\b(indiana|indianapolis|fort wayne|evansville|south bend)\b/i.test(
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

export async function searchInMycase(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("in-mycase", `${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("in-mycase", 1200);

  const land = await fetchWithTimeout(LANDING, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["in-mycase"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });
  if (!land.ok) {
    throw new Error(`Indiana MyCase landing HTTP ${land.status}`);
  }
  const cookie = cookieHeader(land);

  const body = {
    Mode: "ByParty",
    First: first,
    Last: last,
    Middle: null,
    Business: null,
    CourtItemID: 92, // All Odyssey Courts
    ActiveFlag: "All",
    SoundEx: false,
    Categories: null,
    Limits: null,
    Skip: 0,
    Take: Math.min(Math.max(limit, 1), 50),
    Sort: "FileDate DESC",
    NewSearch: true,
    CaptchaAnswer: null,
  };

  const res = await fetchWithTimeout(`${BASE}/Search/SearchCases`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["in-mycase"].timeoutMs,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: LANDING,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Indiana MyCase HTTP ${res.status}`);
  }

  const json = (await res.json()) as InSearchResponse;
  const rows = json.Results ?? json.Result?.Results ?? [];
  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = [];

  for (const row of rows) {
    const number = row.CaseNumber?.trim();
    if (!number) continue;
    const style = row.Style?.trim() || number;
    const token = row.CaseToken?.trim();
    hits.push({
      id: `in-mycase-${row.CaseID ?? number}`,
      caseName: style,
      docketNumber: number,
      court: row.Court
        ? `Indiana · ${row.Court}`
        : "Indiana courts",
      dateFiled: row.FileDate || undefined,
      natureOfSuit: row.CaseType || undefined,
      snippet: row.CaseStatus ? `Status: ${row.CaseStatus}` : undefined,
      source: {
        id: "in-mycase",
        label: "Indiana MyCase",
        jurisdiction: "Indiana trial courts",
        retrievedAt,
        deepLink: token
          ? `${LANDING}#/Case?token=${encodeURIComponent(token)}`
          : LANDING,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["in-mycase"].ttlMs);
  return hits;
}
