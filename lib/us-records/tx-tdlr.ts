import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

export function shouldSearchTxTdlr(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "TX") return false;
  if (parsed.state === "TX") return true;
  return /\b(tdlr|texas)\b/i.test(parsed.raw);
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

type TdlrRow = {
  license: string;
  expDate: string;
  status?: string;
  name: string;
  county: string;
};

function parseTdlrRows(html: string): TdlrRow[] {
  const plain = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );

  const rows: TdlrRow[] = [];
  const headerRe =
    /(?:^|[\s|])([A-Za-z]{2,}(?:\([A-Za-z]+\))?)\s*-\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(Expired|Inactive))?/g;
  const headers = [...plain.matchAll(headerRe)];

  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]!;
    const start = (header.index ?? 0) + header[0].length;
    const end = headers[i + 1]?.index ?? plain.length;
    let rest = plain.slice(start, end).trim();
    rest = rest
      .replace(/\s+If license not found[\s\S]*$/i, "")
      .replace(/\s+(Next|Last|Search Again|Back|&nbsp;).*$/i, "")
      .trim();
    if (!rest.includes(",")) continue;

    let name: string;
    let county: string;
    if (/\bOUT OF STATE\s*$/i.test(rest)) {
      county = "OUT OF STATE";
      name = rest.replace(/\s+OUT OF STATE\s*$/i, "").trim();
    } else {
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;
      county = parts.pop()!;
      // Guard against phone/footer tokens
      if (/^\d/.test(county) || county.length < 3) continue;
      name = parts.join(" ");
    }

    rows.push({
      license: `${header[1]} - ${header[2]}`,
      expDate: header[3]!,
      status: header[4] || undefined,
      name,
      county,
    });
  }
  return rows;
}

/**
 * Texas TDLR active license search (form POST twin).
 * Optional city / ZIP / county filters when known.
 * `tdlr_status=-1` searches all license types.
 */
export async function searchTxTdlrLicense(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) {
    throw new Error("TDLR search needs a name (e.g. John Smith, TX).");
  }

  // TDLR name field matches last-name-first strings best with last name alone,
  // then we score against the full needle.
  const searchName = (parsed.lastName || needle).toUpperCase();

  const key = cacheKey(
    "tx-tdlr-v4",
    `${searchName}|${needle}|${parsed.city || ""}|${parsed.zip || ""}|${parsed.county || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  await paceSource("tx-tdlr", 700);

  const body = new URLSearchParams({
    tdlr_status: "-1",
    pht_lic: "",
    pht_expdt: "",
    pht_oth_name: searchName,
    phy_city: (parsed.city || "").toUpperCase(),
    phy_cnty: (parsed.county || "").replace(/\s+County$/i, "").toUpperCase(),
    phy_zip: parsed.zip || "",
    B1: "Search",
  });

  const res = await fetchWithTimeout(
    "https://www.tdlr.texas.gov/LicenseSearch/SearchResultsListBrowse.asp?from=search",
    {
      method: "POST",
      cache: "no-store",
      timeoutMs: SOURCE_LIMITS["tx-tdlr"].timeoutMs,
      headers: {
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_UA,
        Origin: "https://www.tdlr.texas.gov",
        Referer: "https://www.tdlr.texas.gov/LicenseSearch/",
      },
      body: body.toString(),
    },
  );

  if (!res.ok) throw new Error(`TDLR HTTP ${res.status}`);
  const html = await res.text();
  const retrievedAt = new Date().toISOString();

  const hits: PersonHit[] = parseTdlrRows(html)
    .map((row) => ({
      row,
      score: scoreNameMatch(row.name, needle),
    }))
    .filter((r) => {
      if (r.score < 40) return false;
      if (parsed.firstName) {
        const afterComma = r.row.name.split(",")[1] || "";
        if (
          !new RegExp(`\\b${parsed.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
            afterComma,
          )
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `tx-tdlr-${row.license}-${row.name}`.slice(0, 180),
      name: row.name,
      kind: "provider" as const,
      subtitle: [row.license, row.status, row.county].filter(Boolean).join(" · "),
      state: "TX",
      country: "US",
      details: [
        { label: "License", value: row.license },
        ...(row.status ? [{ label: "Status", value: row.status }] : []),
        { label: "Expires", value: row.expDate },
        ...(row.county ? [{ label: "County", value: row.county }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "tx-tdlr" as const,
        label: "Texas TDLR",
        jurisdiction: "Texas",
        retrievedAt,
        deepLink: "https://www.tdlr.texas.gov/LicenseSearch/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["tx-tdlr"].ttlMs);
  return hits;
}
