import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

/**
 * Hillsborough County (FL) HOVER case search.
 * Captcha workaround: anonymous login + validateexistingguid, then POST /case/search
 * with empty CaseStatus (string enums like "ALL" error).
 */
const BASE = "https://hover.hillsclerk.com";

type HoverUser = {
  userName?: string;
  requestorGuid?: string;
  requestorToken?: string;
  token?: string;
};

type HoverCaseRow = {
  caseID?: number | string;
  caseNumber?: string;
  caseStyle?: string;
  partyName?: string;
  caseStatus?: string;
  dateFiled?: string;
  caseType?: string;
  caseCategory?: string;
  courtType?: string;
  division?: string;
};

type HoverSearchResponse = {
  data?: HoverCaseRow[];
  recordsFiltered?: number;
  recordsTotal?: number;
  firstPartyEnabled?: boolean;
  blockScript?: string;
};

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Hillsborough HOVER (e.g. John Smith, FL).",
  );
}

export function shouldSearchFlHover(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.state === "FL") return true;
  return /\b(florida|hillsborough|tampa|brandon|plant city)\b/i.test(parsed.raw);
}

function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === "function") {
    return withGetter.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx > 0) map.set(part.slice(0, idx), part.slice(idx + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0] ?? "";
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    map.set(first.slice(0, idx), first.slice(idx + 1));
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function openHoverSession(): Promise<{ cookie: string; user: HoverUser }> {
  let cookie = "";

  const land = await fetchWithTimeout(`${BASE}/html/case/caseSearch.html`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-hover"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });
  cookie = mergeCookies(cookie, readSetCookies(land.headers));
  await land.text();

  const cfg = await fetchWithTimeout(`${BASE}/api/px/config`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-hover"].timeoutMs,
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/html/case/caseSearch.html`,
    },
  });
  cookie = mergeCookies(cookie, readSetCookies(cfg.headers));
  await cfg.text();

  const anon = await fetchWithTimeout(`${BASE}/hoverapiaccount/loganonymous`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-hover"].timeoutMs,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Origin: BASE,
      Referer: `${BASE}/html/case/caseSearch.html`,
    },
    body: JSON.stringify({}),
  });
  cookie = mergeCookies(cookie, readSetCookies(anon.headers));
  if (!anon.ok) {
    throw new Error(`Hillsborough HOVER anonymous login HTTP ${anon.status}`);
  }
  const user = (await anon.json()) as HoverUser;
  if (!user.requestorGuid) {
    throw new Error("Hillsborough HOVER did not return a requestorGuid.");
  }

  const validate = await fetchWithTimeout(
    `${BASE}/newcaptcha/validateexistingguid`,
    {
      method: "POST",
      cache: "no-store",
      timeoutMs: SOURCE_LIMITS["fl-hover"].timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        Cookie: cookie,
        Origin: BASE,
        Referer: `${BASE}/html/case/caseSearch.html`,
      },
      body: JSON.stringify({
        requestorGuid: user.requestorGuid,
        RequestorGuid: user.requestorGuid,
      }),
    },
  );
  cookie = mergeCookies(cookie, readSetCookies(validate.headers));
  const validateText = await validate.text();
  if (!validate.ok || !/true/i.test(validateText)) {
    throw new Error(
      `Hillsborough HOVER captcha GUID validation failed: ${validateText.slice(0, 120)}`,
    );
  }

  return { cookie, user };
}

export async function searchFlHover(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("fl-hover", `${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("fl-hover", 1500);
  const { cookie, user } = await openHoverSession();

  const res = await fetchWithTimeout(`${BASE}/case/search`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-hover"].timeoutMs,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Origin: BASE,
      Referer: `${BASE}/html/case/caseSearch.html`,
      "X-Requested-With": "XMLHttpRequest",
      requestorGuid: user.requestorGuid || "",
    },
    body: JSON.stringify({
      SearchType: "ByParty",
      LastName: last,
      FirstName: first,
      MiddleName: "",
      DateOfBirth: "",
      UseSoundex: false,
      ExtendedSearch: false,
      // Do not send CaseStatus/CaseCategory enums — "ALL" throws server-side.
      UserName: user.userName || "Anonymous",
      RequestorGuid: user.requestorGuid,
      RequestorUserName: user.userName || "Anonymous",
      RequestorToken: user.requestorToken || user.token || "",
      CaptchaCode: "",
      CaptchaHash: "",
    }),
  });

  const text = await res.text();
  let body: HoverSearchResponse;
  try {
    body = JSON.parse(text) as HoverSearchResponse;
  } catch {
    throw new Error(`Hillsborough HOVER returned non-JSON (${res.status}).`);
  }

  if (body.blockScript || body.firstPartyEnabled) {
    throw new Error(
      "Hillsborough HOVER blocked the search (PerimeterX / bot challenge).",
    );
  }
  if (!res.ok) {
    throw new Error(`Hillsborough HOVER HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  const retrievedAt = new Date().toISOString();
  const rows = body.data ?? [];
  const hits: CourtCaseHit[] = rows.slice(0, limit).map((row, index) => {
    const docket = row.caseNumber || String(row.caseID || index);
    const party = row.partyName;
    const style = row.caseStyle || `${party || `${last}, ${first}`} — ${docket}`;
    return {
      id: `fl-hover-${row.caseID || docket}`,
      caseName: style,
      docketNumber: docket,
      court: [
        "Hillsborough County, FL",
        row.courtType,
        row.division,
        row.caseCategory,
      ]
        .filter(Boolean)
        .join(" · "),
      dateFiled: row.dateFiled || undefined,
      natureOfSuit: row.caseType || row.caseCategory,
      snippet: [row.caseStatus, row.caseType, party ? `Party: ${party}` : null]
        .filter(Boolean)
        .join(" · "),
      parties: party ? [party] : undefined,
      source: {
        id: "fl-hover",
        label: "Hillsborough HOVER",
        jurisdiction: "Hillsborough County, Florida",
        retrievedAt,
        deepLink: `${BASE}/html/case/caseSearch.html`,
        confidence: "high",
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS["fl-hover"].ttlMs);
  return hits;
}
