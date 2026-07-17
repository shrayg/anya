import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

/**
 * Oklahoma OSCN party search via Results.ashx — bypasses the Turnstile wall
 * that blocks Results.aspx / Search.aspx.
 */
const BASE = "https://www.oscn.net/dockets";

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Oklahoma OSCN (e.g. James Williams, OK).",
  );
}

export function shouldSearchOkOscn(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.state === "OK") return true;
  return /\b(oklahoma|tulsa|oklahoma city|okc)\b/i.test(parsed.raw);
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

export async function searchOkOscn(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const county = parsed.county?.toLowerCase().includes("tulsa")
    ? "tulsa"
    : "oklahoma";
  const key = cacheKey("ok-oscn", `${county}|${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("ok-oscn", 1200);

  const url =
    `${BASE}/Results.ashx?` +
    new URLSearchParams({
      db: county,
      lname: last,
      fname: first,
      partytype: "0",
    }).toString();

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["ok-oscn"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
      Referer: `${BASE}/Search.aspx`,
    },
  });

  if (!res.ok) {
    throw new Error(`Oklahoma OSCN HTTP ${res.status}`);
  }

  const html = await res.text();
  if (/turnstile/i.test(html)) {
    throw new Error("Oklahoma OSCN returned Cloudflare Turnstile.");
  }

  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = [];
  const seen = new Set<string>();

  const rowRe =
    /GetCaseInformation\.aspx\?db=([^&"]+)&number=([^&"]+)&cmid=(\d+)[^>]*>\s*([^<]+)<\/a><\/td>\s*<td class="result_datefiled">([^<]*)<\/td>\s*<td class="result_shortstyle[^"]*"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]*)[\s\S]{0,400}?class="result_partyname[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;

  for (const match of html.matchAll(rowRe)) {
    const db = match[1] ?? county;
    const number = decodeURIComponent(match[2] ?? "");
    const cmid = match[3] ?? "";
    const filed = decodeEntities(match[5] ?? "");
    const style = decodeEntities(match[6] ?? "");
    const party = decodeEntities((match[7] ?? "").replace(/<[^>]+>/g, " "));
    const id = `${db}-${number}-${cmid}`;
    if (!number || seen.has(id)) continue;
    seen.add(id);

    hits.push({
      id: `ok-oscn-${id}`,
      caseName: style || `${party} — ${number}`,
      docketNumber: number,
      court: `Oklahoma · ${db} County`,
      dateFiled: filed || undefined,
      snippet: party ? `Party: ${party}` : undefined,
      parties: party ? [party] : undefined,
      source: {
        id: "ok-oscn",
        label: "Oklahoma OSCN",
        jurisdiction: "Oklahoma district courts",
        retrievedAt,
        deepLink: `${BASE}/GetCaseInformation.aspx?db=${encodeURIComponent(db)}&number=${encodeURIComponent(number)}&cmid=${cmid}`,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  // Fallback looser parse if party column shape differs
  if (!hits.length) {
    for (const match of html.matchAll(
      /GetCaseInformation\.aspx\?db=([^&"]+)&number=([^&"]+)&cmid=(\d+)[^>]*>\s*([^<]+)<\/a><\/td>\s*<td class="result_datefiled">([^<]*)<\/td>\s*<td class="result_shortstyle[^"]*"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]*)/gi,
    )) {
      const db = match[1] ?? county;
      const number = decodeURIComponent(match[2] ?? "");
      const cmid = match[3] ?? "";
      const filed = decodeEntities(match[5] ?? "");
      const style = decodeEntities(match[6] ?? "");
      const id = `${db}-${number}-${cmid}`;
      if (!number || seen.has(id)) continue;
      seen.add(id);
      hits.push({
        id: `ok-oscn-${id}`,
        caseName: style || number,
        docketNumber: number,
        court: `Oklahoma · ${db} County`,
        dateFiled: filed || undefined,
        source: {
          id: "ok-oscn",
          label: "Oklahoma OSCN",
          jurisdiction: "Oklahoma district courts",
          retrievedAt,
          deepLink: `${BASE}/GetCaseInformation.aspx?db=${encodeURIComponent(db)}&number=${encodeURIComponent(number)}&cmid=${cmid}`,
          confidence: "high",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, SOURCE_LIMITS["ok-oscn"].ttlMs);
  return hits;
}
