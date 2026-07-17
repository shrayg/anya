import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

/**
 * Florida FDLE Sex Offender / Predator Search (SOPS).
 * Uses home.jsf ViewState + name search (jakarta.faces), then parses results.
 */
const BASE = "https://offender.fdle.state.fl.us/offender/sops";

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for FDLE SOR (e.g. Robert Smith, FL).",
  );
}

export function shouldSearchFlFdle(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state === "FL") return true;
  return /\b(florida|miami|tampa|orlando|jacksonville|fdle)\b/i.test(
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

function mergeCookies(a: string, b: string): string {
  const map = new Map<string, string>();
  for (const part of `${a};${b}`
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
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

function extractViewState(html: string): string {
  return (
    html.match(
      /name="jakarta\.faces\.ViewState"[^>]*value="([^"]*)"/,
    )?.[1] ||
    html.match(/ViewState[^>]*><!\[CDATA\[([^\]]+)/)?.[1] ||
    ""
  );
}

export async function searchFlFdle(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<PersonHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("fl-fdle", `${last}|${first}|${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  await paceSource("fl-fdle", 1500);

  const home = await fetchWithTimeout(`${BASE}/home.jsf`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });
  if (!home.ok) {
    throw new Error(`FDLE SOR landing HTTP ${home.status}`);
  }
  let cookie = cookieHeader(home);
  let html = await home.text();
  let viewState = extractViewState(html);

  // Accept disclaimer when present
  if (/name="yesBtn"|id="yesBtn"/.test(html)) {
    const acc = await fetchWithTimeout(`${BASE}/home.jsf`, {
      method: "POST",
      cache: "no-store",
      timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
      headers: {
        Accept: "application/xml, text/xml, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_UA,
        Cookie: cookie,
        "Faces-Request": "partial/ajax",
        Referer: `${BASE}/home.jsf`,
      },
      body: new URLSearchParams({
        "jakarta.faces.partial.ajax": "true",
        "jakarta.faces.source": "yesBtn",
        "jakarta.faces.partial.execute": "yesBtn",
        "jakarta.faces.partial.render": "homeForm",
        yesBtn: "yesBtn",
        "jakarta.faces.ViewState": viewState,
      }),
    });
    cookie = mergeCookies(cookie, cookieHeader(acc));
    const accText = await acc.text();
    viewState = extractViewState(accText) || viewState;

    const refreshed = await fetchWithTimeout(`${BASE}/home.jsf`, {
      method: "GET",
      cache: "no-store",
      timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
      headers: {
        Accept: "text/html",
        "User-Agent": BROWSER_UA,
        Cookie: cookie,
      },
    });
    cookie = mergeCookies(cookie, cookieHeader(refreshed));
    html = await refreshed.text();
    viewState = extractViewState(html) || viewState;
  }

  // PrimeFaces AJAX click (matches browser onclick) then follow redirect
  const ajax = await fetchWithTimeout(`${BASE}/home.jsf`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
    headers: {
      Accept: "application/xml, text/xml, */*",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      "Faces-Request": "partial/ajax",
      Referer: `${BASE}/home.jsf`,
      Origin: "https://offender.fdle.state.fl.us",
    },
    body: new URLSearchParams({
      "jakarta.faces.partial.ajax": "true",
      "jakarta.faces.source": "homeForm:offenderSearchBtn",
      "jakarta.faces.partial.execute": "homeForm",
      "jakarta.faces.partial.render": "homeForm:basic",
      homeForm: "homeForm",
      "homeForm:firstName": first,
      "homeForm:lastName": last,
      "homeForm:offenderSearchBtn": "homeForm:offenderSearchBtn",
      "jakarta.faces.ViewState": viewState,
    }),
  });
  cookie = mergeCookies(cookie, cookieHeader(ajax));
  const ajaxText = await ajax.text();
  const redirect =
    ajaxText.match(/<redirect url="([^"]+)"/)?.[1] ||
    "/offender/sops/offenderSearch.jsf";

  // Full form POST also lands on results page with datagrid
  const search = await fetchWithTimeout(`${BASE}/home.jsf`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/home.jsf`,
      Origin: "https://offender.fdle.state.fl.us",
    },
    body: new URLSearchParams({
      homeForm: "homeForm",
      "homeForm:firstName": first,
      "homeForm:lastName": last,
      "homeForm:offenderSearchBtn": "homeForm:offenderSearchBtn",
      "jakarta.faces.ViewState": extractViewState(ajaxText) || viewState,
    }),
    redirect: "follow",
  });

  if (!search.ok) {
    // Fall back to GET of redirect target after AJAX
    const fallback = await fetchWithTimeout(
      redirect.startsWith("http")
        ? redirect
        : `https://offender.fdle.state.fl.us${redirect}`,
      {
        method: "GET",
        cache: "no-store",
        timeoutMs: SOURCE_LIMITS["fl-fdle"].timeoutMs,
        headers: {
          Accept: "text/html",
          "User-Agent": BROWSER_UA,
          Cookie: cookie,
          Referer: `${BASE}/home.jsf`,
        },
      },
    );
    if (!fallback.ok) {
      throw new Error(`FDLE SOR HTTP ${search.status}`);
    }
    html = await fallback.text();
  } else {
    html = await search.text();
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  // Flyer / detail links
  for (const match of html.matchAll(
    /href="([^"]*flyer\.jsf[^"]*)"[\s\S]{0,400}?>([\s\S]*?)<\/a>/gi,
  )) {
    const href = (match[1] ?? "").replace(/&amp;/g, "&");
    const label = decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, " "));
    if (!label || seen.has(href)) continue;
    seen.add(href);
    hits.push({
      id: `fl-fdle-${hits.length}-${label.slice(0, 40)}`,
      name: label,
      kind: "sex-offender",
      subtitle: "Florida FDLE Sex Offender / Predator Registry",
      state: "FL",
      details: [],
      source: {
        id: "fl-fdle",
        label: "Florida FDLE SOR",
        jurisdiction: "Florida",
        retrievedAt,
        deepLink: href.startsWith("http")
          ? href
          : `https://offender.fdle.state.fl.us${href}`,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  // Name spans when flyer anchors are sparse
  if (!hits.length) {
    for (const match of html.matchAll(
      /class="[^"]*(?:offenderName|offender-name)[^"]*"[^>]*>([^<]+)/gi,
    )) {
      const name = decodeEntities(match[1] ?? "");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      hits.push({
        id: `fl-fdle-${hits.length}-${name.slice(0, 40)}`,
        name,
        kind: "sex-offender",
        subtitle: "Florida FDLE Sex Offender / Predator Registry",
        state: "FL",
        details: [],
        source: {
          id: "fl-fdle",
          label: "Florida FDLE SOR",
          jurisdiction: "Florida",
          retrievedAt,
          deepLink: `${BASE}/home.jsf`,
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, SOURCE_LIMITS["fl-fdle"].ttlMs);
  return hits;
}
