import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsJson,
} from "@/lib/us-records/robots-and-limits";

type TickerRow = { cik_str: number; ticker: string; title: string };

async function loadTickerIndex(): Promise<TickerRow[]> {
  const key = "sec-edgar:tickers-v1";
  const cached = getCached<TickerRow[]>(key);

  if (cached) return cached;
  const data = await fetchUsRecordsJson<Record<string, TickerRow>>(
    "https://www.sec.gov/files/company_tickers.json",
    {
      source: "sec-edgar",
      minIntervalMs: 500,
      userAgent: "AnyaInt OSINT research bot contact@anya.int",
      headers: { Accept: "application/json" },
    },
  );
  const rows = Object.values(data || {});

  setCached(key, rows, 6 * 60 * 60 * 1000);

  return rows;
}

export async function searchSecEdgar(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("sec-edgar", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const retrievedAt = new Date().toISOString();
  const tickers = await loadTickerIndex();
  const hits: PersonHit[] = tickers
    .map((row) => ({ row, score: scoreNameMatch(row.title, needle) }))
    .filter((r) => r.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => {
      const cik = String(row.cik_str).padStart(10, "0");

      return {
        id: `sec-edgar-cik-${cik}`,
        name: row.title,
        kind: "business" as const,
        subtitle: `${row.ticker} · CIK ${cik}`,
        country: "US",
        details: [
          { label: "Ticker", value: row.ticker },
          { label: "CIK", value: cik },
          { label: "Match score", value: String(score) },
        ],
        source: {
          id: "sec-edgar",
          label: "SEC EDGAR",
          jurisdiction: "United States",
          retrievedAt,
          deepLink: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&owner=include&count=40`,
          confidence: (score >= 80 ? "high" : "medium") as "high" | "medium",
        },
      };
    });

  // Optional full-text fallback omitted when tickers already hit
  if (!hits.length) {
    const end = new Date();
    const start = new Date();

    start.setFullYear(end.getFullYear() - 5);
    const url =
      `https://efts.sec.gov/LATEST/search-index?` +
      new URLSearchParams({
        q: `"${needle.replace(/"/g, "")}"`,
        dateRange: "custom",
        startdt: start.toISOString().slice(0, 10),
        enddt: end.toISOString().slice(0, 10),
      }).toString();
    const data = await fetchUsRecordsJson<{
      hits?: {
        hits?: Array<{
          _id?: string;
          _source?: {
            display_names?: string[];
            form?: string;
            file_date?: string;
          };
        }>;
      };
    }>(url, {
      source: "sec-edgar",
      minIntervalMs: 800,
      userAgent: BROWSER_UA,
      headers: {
        Referer: "https://www.sec.gov/",
        Origin: "https://www.sec.gov",
      },
    });

    for (const row of data.hits?.hits ?? []) {
      const src = row._source || {};
      const name = src.display_names?.[0] || needle;

      hits.push({
        id: `sec-edgar-${row._id || name}`.slice(0, 180),
        name,
        kind: "business",
        subtitle:
          [src.form, src.file_date].filter(Boolean).join(" · ") || "SEC filing",
        country: "US",
        details: [],
        source: {
          id: "sec-edgar",
          label: "SEC EDGAR",
          jurisdiction: "United States",
          retrievedAt,
          deepLink: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(needle)}`,
          confidence: "medium",
        },
      });
      if (hits.length >= limit) break;
    }
  }

  setCached(key, hits, 6 * 60 * 60 * 1000);

  return hits;
}
