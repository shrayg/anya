import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type ProPublicaOrg = {
  ein?: number;
  strein?: string;
  name?: string;
  sub_name?: string;
  city?: string;
  state?: string;
  ntee_code?: string | null;
  subseccd?: number;
  score?: number;
};

type ProPublicaSearch = {
  total_results?: number;
  organizations?: ProPublicaOrg[];
};

/**
 * IRS Exempt Organizations via ProPublica Nonprofit Explorer API
 * (mirrors IRS EO BMF). Optional state/city filters when known.
 */
export async function searchIrsEoNonprofit(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];

  const key = cacheKey(
    "irs-eo",
    `${needle}|${parsed.state || ""}|${parsed.city || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const params = new URLSearchParams({
    q: needle,
    page: "0",
  });

  if (parsed.state) params.set("state[id]", parsed.state.toUpperCase());

  const data = await fetchUsRecordsJson<ProPublicaSearch>(
    `https://projects.propublica.org/nonprofits/api/v2/search.json?${params}`,
    {
      source: "irs-eo",
      minIntervalMs: 350,
    },
  );

  const retrievedAt = new Date().toISOString();
  let orgs = data.organizations || [];

  if (parsed.city) {
    const city = parsed.city.toLowerCase();

    orgs = orgs.filter((row) => (row.city || "").toLowerCase().includes(city));
  }

  const hits = orgs
    .map((row) => ({
      row,
      score: scoreNameMatch(row.name || row.sub_name || "", needle),
    }))
    .filter((r) => (r.row.name || r.row.sub_name) && r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `irs-eo-${row.ein || row.name}`.slice(0, 180),
      name: row.name || row.sub_name || needle,
      kind: "business" as const,
      subtitle: [
        row.city,
        row.state,
        row.subseccd ? `501(c)(${row.subseccd})` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      state: row.state || parsed.state,
      country: "US",
      details: [
        ...(row.strein || row.ein
          ? [{ label: "EIN", value: row.strein || String(row.ein) }]
          : []),
        ...(row.city ? [{ label: "City", value: row.city }] : []),
        ...(row.state ? [{ label: "State", value: row.state }] : []),
        ...(row.ntee_code ? [{ label: "NTEE", value: row.ntee_code }] : []),
        ...(row.subseccd
          ? [{ label: "Subsection", value: `501(c)(${row.subseccd})` }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "irs-eo" as const,
        label: "IRS EO (ProPublica)",
        jurisdiction: "United States",
        retrievedAt,
        deepLink: row.ein
          ? `https://projects.propublica.org/nonprofits/organizations/${row.ein}`
          : "https://projects.propublica.org/nonprofits/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["irs-eo"].ttlMs);

  return hits;
}
