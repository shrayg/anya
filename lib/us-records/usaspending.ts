import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  fetchUsRecordsPostJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type UsaSpendingResult = {
  results?: Array<{
    recipient_id?: string;
    recipient_name?: string;
    recipient_level?: string;
    uei?: string;
    duns?: string;
  }>;
};

/**
 * USASpending.gov recipient autocomplete — federal award recipients.
 */
export async function searchUsaSpending(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];

  const key = cacheKey("usaspending", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const data = await fetchUsRecordsPostJson<UsaSpendingResult>(
    "https://api.usaspending.gov/api/v2/autocomplete/recipient/",
    {
      source: "usaspending",
      minIntervalMs: 300,
      body: { search_text: needle, limit: Math.min(limit, 20) },
    },
  );

  const retrievedAt = new Date().toISOString();
  const hits = (data.results || [])
    .map((row) => ({
      row,
      score: scoreNameMatch(row.recipient_name || "", needle),
    }))
    .filter((r) => r.row.recipient_name && r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `usaspending-${row.recipient_id || row.recipient_name}`.slice(0, 180),
      name: row.recipient_name || needle,
      kind: "business" as const,
      subtitle: "USASpending federal award recipient",
      country: "US",
      details: [
        ...(row.uei ? [{ label: "UEI", value: row.uei }] : []),
        ...(row.duns ? [{ label: "DUNS", value: row.duns }] : []),
        ...(row.recipient_level
          ? [{ label: "Level", value: row.recipient_level }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "usaspending" as const,
        label: "USASpending.gov",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: "https://www.usaspending.gov/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["usaspending"].ttlMs);

  return hits;
}
