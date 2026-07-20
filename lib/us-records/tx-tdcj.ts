import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { BROWSER_UA, SOURCE_LIMITS } from "@/lib/us-records/robots-and-limits";

export function shouldSearchTxTdcj(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (!parsed.firstName || !parsed.lastName) return false;
  if (parsed.state === "TX") return true;

  return /\b(texas|tdcj)\b/i.test(parsed.raw);
}

/**
 * Texas TDCJ Inmate Search — session cookie + form POST.
 * Must send gender=ALL and race=ALL (empty values return zero hits).
 */
export async function searchTxTdcj(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  if (!parsed.firstName || !parsed.lastName) {
    throw new Error(
      "Enter a first and last name for TDCJ inmate search (e.g. Jose Garcia).",
    );
  }
  const first = parsed.firstName;
  const last = parsed.lastName;

  const key = cacheKey("tx-tdcj", `${last}|${first}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const startRes = await fetch(
    "https://inmate.tdcj.texas.gov/InmateSearch/start.action",
    {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
    },
  );

  if (!startRes.ok) throw new Error(`TDCJ start HTTP ${startRes.status}`);

  const setCookie =
    typeof startRes.headers.getSetCookie === "function"
      ? startRes.headers.getSetCookie()
      : [startRes.headers.get("set-cookie") || ""];
  const cookie = setCookie
    .filter(Boolean)
    .map((c) => c.split(";")[0]!)
    .join("; ");

  const body = new URLSearchParams({
    page: "index",
    lastName: last.toUpperCase(),
    firstName: first.toUpperCase(),
    tdcj: "",
    sid: "",
    gender: "ALL",
    race: "ALL",
    btnSearch: "Search",
  });

  const searchRes = await fetch(
    "https://inmate.tdcj.texas.gov/InmateSearch/search.action",
    {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
        Referer: "https://inmate.tdcj.texas.gov/InmateSearch/start.action",
        Origin: "https://inmate.tdcj.texas.gov",
        Accept: "text/html",
      },
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_LIMITS["tx-tdcj"].timeoutMs),
    },
  );

  if (!searchRes.ok) throw new Error(`TDCJ search HTTP ${searchRes.status}`);

  const html = await searchRes.text();

  if (/No Matches Found/i.test(html)) {
    setCached(key, [], SOURCE_LIMITS["tx-tdcj"].ttlMs);

    return [];
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    if (hits.length >= limit) break;
    const block = row[0];
    const cells = [...block.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) =>
        m[1]!
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);

    if (cells.length < 3) continue;
    const nameCell =
      cells.find((c) => /^[A-Z][A-Z' -]+,\s*[A-Z]/i.test(c)) || cells[0] || "";
    const nameMatch = nameCell.match(/^([A-Z][A-Z' -]+),\s*([A-Z][A-Z' -]+)$/i);

    if (!nameMatch) continue;
    const tdcj = cells.find((c) => /^\d{5,8}$/.test(c)) || "";

    if (!tdcj || seen.has(tdcj)) continue;
    seen.add(tdcj);
    const sid = (block.match(/viewDetail\.action\?sid=(\d+)/i) || [])[1];
    const age = cells.find((c) => /^\d{1,3}$/.test(c) && c !== tdcj);
    const unit = cells.find(
      (c) =>
        c.length > 2 &&
        !/^\d+$/.test(c) &&
        !/,/.test(c) &&
        !/^[MF]$/i.test(c) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(c) &&
        c !== nameCell,
    );

    hits.push({
      id: `tx-tdcj-${tdcj}`,
      name: `${nameMatch[2]} ${nameMatch[1]}`,
      kind: "inmate",
      subtitle: unit ? `TDCJ · ${unit}` : "TDCJ inmate",
      country: "US",
      state: "TX",
      details: [
        { label: "TDCJ number", value: tdcj },
        ...(sid ? [{ label: "SID", value: sid }] : []),
        ...(age ? [{ label: "Age", value: age }] : []),
        ...(unit ? [{ label: "Unit", value: unit }] : []),
      ],
      source: {
        id: "tx-tdcj",
        label: "Texas TDCJ Inmate Search",
        jurisdiction: "Texas",
        retrievedAt,
        deepLink: sid
          ? `https://inmate.tdcj.texas.gov/InmateSearch/viewDetail.action?sid=${sid}`
          : "https://inmate.tdcj.texas.gov/InmateSearch/start.action",
        confidence: "high",
      },
    });
  }

  setCached(key, hits, SOURCE_LIMITS["tx-tdcj"].ttlMs);

  return hits;
}
