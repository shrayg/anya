import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

const FEC_BASE = "https://api.open.fec.gov/v1";

type FecCandidate = {
  candidate_id?: string;
  name?: string;
  office_full?: string;
  party_full?: string;
  state?: string;
  district?: string;
  candidate_status?: string;
  cycles?: number[];
};

type FecResponse = {
  results?: FecCandidate[];
};

export function getOpenFecApiKey(): string {
  return process.env.OPENFEC_API_KEY?.trim() || "DEMO_KEY";
}

export async function searchOpenFec(
  parsed: ParsedUsQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const q = parsed.fullName || parsed.raw;

  if (!q || q.length < 2) return [];

  const key = cacheKey("openfec", `${q}:${parsed.state ?? ""}:${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    api_key: getOpenFecApiKey(),
    per_page: String(Math.min(limit, 20)),
    sort: "name",
  });

  if (parsed.state) params.set("state", parsed.state);

  const data = await fetchUsRecordsJson<FecResponse>(
    `${FEC_BASE}/candidates/search/?${params}`,
    { source: "openfec", minIntervalMs: 300 },
  );

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.results ?? [])
    .slice(0, limit)
    .map((row, index) => {
      const id = row.candidate_id || `fec-${index}`;
      const cycles = row.cycles?.slice(-3).join(", ");

      return {
        id,
        name: row.name || q,
        kind: "candidate",
        subtitle:
          [row.office_full, row.party_full].filter(Boolean).join(" · ") ||
          undefined,
        state: row.state || parsed.state,
        details: [
          { label: "Candidate ID", value: id },
          ...(row.office_full
            ? [{ label: "Office", value: row.office_full }]
            : []),
          ...(row.party_full
            ? [{ label: "Party", value: row.party_full }]
            : []),
          ...(row.district ? [{ label: "District", value: row.district }] : []),
          ...(row.candidate_status
            ? [{ label: "Status", value: row.candidate_status }]
            : []),
          ...(cycles ? [{ label: "Recent cycles", value: cycles }] : []),
        ],
        source: {
          id: "openfec",
          label: "FEC OpenFEC",
          jurisdiction: "US federal elections",
          retrievedAt,
          deepLink: row.candidate_id
            ? `https://www.fec.gov/data/candidate/${row.candidate_id}/`
            : "https://www.fec.gov/data/",
          confidence: "medium",
        },
      };
    });

  setCached(key, hits, SOURCE_LIMITS.openfec.ttlMs);

  return hits;
}
