import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsJson,
  fetchUsRecordsText,
} from "@/lib/us-records/robots-and-limits";

export async function searchEuMostWanted(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("eu-most-wanted", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const html = await fetchUsRecordsText("https://eumostwanted.eu/", {
    source: "eu-most-wanted",
    minIntervalMs: 1200,
    userAgent: BROWSER_UA,
  });

  type Row = { nid: string; name: string };
  const rows: Row[] = [];
  const titles = [
    ...html.matchAll(
      /views-field-title[\s\S]*?<span class="field-content">([^<]+)<\/span>/gi,
    ),
  ].map((m) => (m[1] || "").trim());
  const nids = [
    ...html.matchAll(
      /views-field-nid[\s\S]*?<span class="field-content">(\d+)<\/span>/gi,
    ),
  ].map((m) => m[1] || "");

  for (let i = 0; i < titles.length; i += 1) {
    rows.push({ nid: nids[i] || String(i), name: titles[i]! });
  }

  const retrievedAt = new Date().toISOString();
  const hits = rows
    .map((row) => ({ row, score: scoreNameMatch(row.name, needle) }))
    .filter((r) => r.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `eu-most-wanted-${row.nid || row.name}`,
      name: row.name,
      kind: "wanted" as const,
      subtitle: "Europe's Most Wanted (ENFAST)",
      details: [{ label: "Match score", value: String(score) }],
      source: {
        id: "eu-most-wanted" as const,
        label: "Europe's Most Wanted",
        jurisdiction: "European Union / ENFAST",
        retrievedAt,
        deepLink: row.nid
          ? `https://eumostwanted.eu/node/${row.nid}`
          : "https://eumostwanted.eu/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, 6 * 60 * 60 * 1000);

  return hits;
}

type WbFirm = {
  SUPP_NAME?: string;
  ADD_SUPP_INFO?: string | null;
  SUPPLIER_NAME?: string;
  COUNTRY_NAME?: string;
  DEBAR_FROM_DATE?: string;
  DEBAR_TO_DATE?: string;
  GROUNDS?: string;
};

type WbResponse = {
  response?: { ZPROCSUPP?: WbFirm[] };
  ZPROCSUPP?: WbFirm[];
};

export async function searchWorldBankDebarred(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("worldbank-debarred", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const WB_API_KEY = "z9duUaFUiEUYSHs97CU38fcZO7ipOPvm";
  const data = await fetchUsRecordsJson<WbResponse>(
    "https://apigwext.worldbank.org/dvsvc/v1.0/json/APPLICATION/ADOBE_EXPRNCE_MGR/FIRM/SANCTIONED_FIRM",
    {
      source: "worldbank-debarred",
      minIntervalMs: 1000,
      userAgent: BROWSER_UA,
      headers: {
        apiKey: WB_API_KEY,
        Accept: "application/json",
        Referer:
          "https://www.worldbank.org/en/projects-operations/procurement/debarred-firms",
        Origin: "https://www.worldbank.org",
      },
    },
  );

  const firms = data.response?.ZPROCSUPP || data.ZPROCSUPP || [];
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const hits = firms
    .map((firm) => {
      const name = (
        firm.SUPPLIER_NAME ||
        `${firm.SUPP_NAME || ""}${firm.ADD_SUPP_INFO || ""}` ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

      return { firm, name, score: scoreNameMatch(name, needle) };
    })
    .filter((row) => {
      if (!row.name || row.score < 50) return false;
      const k = row.name.toUpperCase();

      if (seen.has(k)) return false;
      seen.add(k);

      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ firm, name, score }) => ({
      id: `worldbank-debarred-${name}`.slice(0, 180),
      name,
      kind: "sanctions" as const,
      subtitle: "World Bank debarred firm / individual",
      country: firm.COUNTRY_NAME,
      details: [
        ...(firm.COUNTRY_NAME
          ? [{ label: "Country", value: firm.COUNTRY_NAME }]
          : []),
        ...(firm.DEBAR_FROM_DATE
          ? [{ label: "Debarred from", value: firm.DEBAR_FROM_DATE }]
          : []),
        ...(firm.DEBAR_TO_DATE
          ? [{ label: "Debarred to", value: firm.DEBAR_TO_DATE }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "worldbank-debarred" as const,
        label: "World Bank Debarment",
        jurisdiction: "World Bank Group",
        retrievedAt,
        deepLink:
          "https://www.worldbank.org/en/projects-operations/procurement/debarred-firms",
        confidence: (score >= 80 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, 24 * 60 * 60 * 1000);

  return hits;
}
