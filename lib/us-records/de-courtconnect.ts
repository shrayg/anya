import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

const BASE = "https://courtconnect.courts.delaware.gov/cc/cconnect";

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for Delaware CourtConnect (e.g. John Smith, DE).",
  );
}

export function shouldSearchDeCourtConnect(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.state === "DE") return true;
  return /\b(delaware|wilmington|dover|newark)\b/i.test(parsed.raw);
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

export async function searchDeCourtConnect(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("de-courtconnect", `${last}|${first}|${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("de-courtconnect", 1200);

  const url =
    `${BASE}/ck_public_qry_cpty.cp_personcase_srch_details?` +
    new URLSearchParams({
      backto: "P",
      soundex_ind: "",
      partial_ind: "",
      last_name: last,
      first_name: first,
      middle_name: "",
      begin_date: "",
      end_date: "",
      case_type: "",
      id_code: "",
      PageNo: "1",
    }).toString();

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["de-courtconnect"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
      Referer: `${BASE}/ck_public_qry_cpty.cp_personcase_srch_setup`,
    },
  });

  if (!res.ok) {
    throw new Error(`Delaware CourtConnect HTTP ${res.status}`);
  }

  const html = await res.text();
  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = [];
  const seen = new Set<string>();

  for (const tr of html.matchAll(/<tr align="left">([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1] ?? "";
    const caseId = row.match(/case_id=([^&"]+)/i)?.[1];
    if (!caseId || seen.has(caseId)) continue;
    seen.add(caseId);

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeEntities((m[1] ?? "").replace(/<[^>]+>/g, " ")),
    );
    const party = cells[1] || "";
    const caseCell = cells[2] || "";
    const role = cells[3] || "";
    const filed = cells[5] || "";
    const caseType = cells[6] || "";
    const styleMatch = caseCell.match(/Case:\s*(.+)$/i);
    const style = decodeEntities(styleMatch?.[1] || caseCell);

    hits.push({
      id: `de-cc-${caseId}`,
      caseName: style || `${party} — ${caseId}`,
      docketNumber: caseId,
      court: "Delaware CourtConnect",
      dateFiled: filed || undefined,
      natureOfSuit: caseType || undefined,
      snippet: [role, caseType, filed].filter(Boolean).join(" · "),
      parties: party ? [party] : undefined,
      source: {
        id: "de-courtconnect",
        label: "Delaware CourtConnect",
        jurisdiction: "Delaware civil courts",
        retrievedAt,
        deepLink: `${BASE}/ck_public_qry_doct.cp_dktrpt_frames?backto=P&case_id=${encodeURIComponent(caseId)}`,
        confidence: "high",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["de-courtconnect"].ttlMs);
  return hits;
}
