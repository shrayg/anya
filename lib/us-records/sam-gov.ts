import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

type SamExclusion = {
  ueiSAM?: string;
  cageCode?: string;
  legalBusinessName?: string;
  exclusionProgram?: string;
  exclusionType?: string;
  excludingAgencyCode?: string;
  activationDate?: string;
  terminationDate?: string;
};

type SamResponse = {
  totalRecords?: number;
  excludedEntity?: SamExclusion[];
};

function getSamApiKey(): string | null {
  return process.env.SAM_GOV_API_KEY?.trim() || null;
}

export async function searchSamExclusions(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const apiKey = getSamApiKey();
  if (!apiKey) {
    throw new Error("SAM.gov is not configured (missing SAM_GOV_API_KEY).");
  }

  const q = parsed.fullName || parsed.raw;
  if (!q || q.length < 2) return [];

  const key = cacheKey("sam-gov", `${q}:${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    api_key: apiKey,
    q,
    pageSize: String(Math.min(limit, 25)),
  });

  const data = await fetchUsRecordsJson<SamResponse>(
    `https://api.sam.gov/entity-information/v3/exclusions?${params}`,
    { source: "sam-gov", minIntervalMs: 800 },
  );

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.excludedEntity ?? []).slice(0, limit).map((row, index) => ({
    id: `sam-${row.ueiSAM || row.cageCode || index}`,
    name: row.legalBusinessName || q,
    kind: "business",
    subtitle: [row.exclusionProgram, row.exclusionType].filter(Boolean).join(" · "),
    country: "US",
    details: [
      ...(row.excludingAgencyCode
        ? [{ label: "Excluding agency", value: row.excludingAgencyCode }]
        : []),
      ...(row.activationDate ? [{ label: "Activation", value: row.activationDate }] : []),
      ...(row.terminationDate ? [{ label: "Termination", value: row.terminationDate }] : []),
      ...(row.ueiSAM ? [{ label: "UEI", value: row.ueiSAM }] : []),
    ],
    source: {
      id: "sam-gov",
      label: "SAM.gov Exclusions",
      jurisdiction: "US federal contractor debarment",
      retrievedAt,
      deepLink: "https://sam.gov/content/exclusions",
      confidence: "high",
    },
  }));

  setCached(key, hits, SOURCE_LIMITS["sam-gov"].ttlMs);
  return hits;
}
