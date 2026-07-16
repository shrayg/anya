import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

type OpenSanctionsEntity = {
  id?: string;
  caption?: string;
  schema?: string;
  properties?: Record<string, string[] | string | undefined>;
  datasets?: string[];
  referents?: string[];
  first_seen?: string;
  last_seen?: string;
};

type OpenSanctionsResponse = {
  results?: OpenSanctionsEntity[];
  total?: { value?: number };
};

function getOpenSanctionsApiKey(): string | null {
  return process.env.OPENSANCTIONS_API_KEY?.trim() || null;
}

function prop(entity: OpenSanctionsEntity, key: string): string | undefined {
  const value = entity.properties?.[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export async function searchOpenSanctions(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const key = getOpenSanctionsApiKey();
  if (!key) {
    throw new Error("OpenSanctions is not configured (missing OPENSANCTIONS_API_KEY).");
  }

  const q = parsed.fullName || parsed.raw;
  if (!q || q.length < 2) return [];

  const cache = cacheKey("opensanctions", `${q}:${limit}`);
  const cached = getCached<PersonHit[]>(cache);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(limit, 25)),
  });
  if (parsed.country) params.set("countries", parsed.country.toLowerCase());

  const data = await fetchUsRecordsJson<OpenSanctionsResponse>(
    `https://api.opensanctions.org/search/default?${params}`,
    {
      source: "opensanctions",
      minIntervalMs: 400,
      headers: { Authorization: `ApiKey ${key}` },
    },
  );

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.results ?? []).slice(0, limit).map((entity) => {
    const name = entity.caption || prop(entity, "name") || q;
    const datasets = (entity.datasets || []).slice(0, 4).join(", ");
    const birthDate = prop(entity, "birthDate");
    const nationality = prop(entity, "nationality") || prop(entity, "country");
    return {
      id: `opensanctions-${entity.id || name}`,
      name,
      kind: "sanctions",
      subtitle: [entity.schema, datasets].filter(Boolean).join(" · ") || "Global sanctions entity",
      country: nationality || parsed.country,
      details: [
        ...(entity.schema ? [{ label: "Schema", value: entity.schema }] : []),
        ...(birthDate ? [{ label: "Birth date", value: birthDate }] : []),
        ...(nationality ? [{ label: "Nationality", value: nationality }] : []),
        ...(datasets ? [{ label: "Datasets", value: datasets }] : []),
        ...(entity.last_seen ? [{ label: "Last seen", value: entity.last_seen }] : []),
      ],
      source: {
        id: "opensanctions",
        label: "OpenSanctions",
        jurisdiction: "International sanctions & PEP index",
        retrievedAt,
        deepLink: entity.id
          ? `https://www.opensanctions.org/entities/${entity.id}/`
          : "https://www.opensanctions.org/",
        confidence: "high",
      },
    };
  });

  setCached(cache, hits, SOURCE_LIMITS.opensanctions.ttlMs);
  return hits;
}

export function hasOpenSanctionsKey(): boolean {
  return Boolean(getOpenSanctionsApiKey());
}
