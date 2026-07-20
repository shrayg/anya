import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

const CL_BASE = "https://www.courtlistener.com/api/rest/v4";

type ClSearchResult = {
  absolute_url?: string;
  caseName?: string;
  caseNameFull?: string;
  docketNumber?: string;
  court?: string;
  court_id?: string;
  dateFiled?: string;
  natureOfSuit?: string;
  snippet?: string;
  cluster_id?: number;
  docket_id?: number;
  id?: number;
};

type ClSearchResponse = {
  count?: number;
  results?: ClSearchResult[];
};

export function getCourtListenerToken(): string | null {
  const token = process.env.COURTLISTENER_TOKEN?.trim();

  return token || null;
}

function buildQuery(parsed: ParsedUsQuery): string {
  if (parsed.caseNumber) return parsed.caseNumber;
  if (parsed.fullName) {
    const quoted = `"${parsed.fullName}"`;

    return parsed.state ? `${quoted} ${parsed.state}` : quoted;
  }

  return parsed.raw;
}

export async function searchCourtListener(
  parsed: ParsedUsQuery,
  limit = 12,
): Promise<CourtCaseHit[]> {
  const token = getCourtListenerToken();

  if (!token) {
    throw new Error(
      "CourtListener is not configured (missing COURTLISTENER_TOKEN).",
    );
  }

  const q = buildQuery(parsed);
  const key = cacheKey("courtlistener", `${q}:${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);

  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    type: "r",
    order_by: "score desc",
    page_size: String(Math.min(limit, 20)),
  });

  const data = await fetchUsRecordsJson<ClSearchResponse>(
    `${CL_BASE}/search/?${params}`,
    {
      source: "courtlistener",
      minIntervalMs: 1200,
      headers: { Authorization: `Token ${token}` },
    },
  );

  const retrievedAt = new Date().toISOString();
  const hits: CourtCaseHit[] = (data.results ?? [])
    .slice(0, limit)
    .map((row, index) => {
      const deepPath = row.absolute_url?.startsWith("http")
        ? row.absolute_url
        : row.absolute_url
          ? `https://www.courtlistener.com${row.absolute_url}`
          : undefined;

      return {
        id: String(
          row.docket_id ?? row.cluster_id ?? row.id ?? `${q}-${index}`,
        ),
        caseName: row.caseNameFull || row.caseName || "Untitled matter",
        docketNumber: row.docketNumber || undefined,
        court: row.court || row.court_id || undefined,
        dateFiled: row.dateFiled || undefined,
        natureOfSuit: row.natureOfSuit || undefined,
        snippet:
          row.snippet?.replace(/<\/?[^>]+(>|$)/g, "").trim() || undefined,
        source: {
          id: "courtlistener",
          label: "CourtListener / RECAP",
          jurisdiction: "US federal (RECAP index)",
          retrievedAt,
          deepLink: deepPath,
          confidence: "high",
        },
      };
    });

  setCached(key, hits, SOURCE_LIMITS.courtlistener.ttlMs);

  return hits;
}

export async function probeCourtListener(): Promise<boolean> {
  if (!getCourtListenerToken()) return false;
  try {
    await searchCourtListener(
      { raw: "smith", mode: "raw", fullName: "Smith" },
      1,
    );

    return true;
  } catch {
    return false;
  }
}
