import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type FbiItem = {
  uid?: string;
  title?: string;
  description?: string;
  subjects?: string[];
  field_offices?: string[];
  url?: string;
  publication?: string;
  reward_text?: string;
  nationality?: string | null;
  possible_states?: string[] | null;
};

type FbiResponse = {
  total?: number;
  items?: FbiItem[];
};

export async function searchFbiWanted(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const name = parsed.fullName || parsed.lastName || parsed.raw;

  if (!name || name.length < 2) return [];

  const key = cacheKey("fbi-wanted", `${name}:${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const params = new URLSearchParams({
    page: "1",
    pageSize: String(Math.min(limit, 20)),
    title: name,
  });

  const data = await fetchUsRecordsJson<FbiResponse>(
    `https://api.fbi.gov/wanted/v1/list?${params}`,
    {
      source: "fbi-wanted",
      minIntervalMs: 500,
      userAgent: BROWSER_UA,
      headers: {
        Referer: "https://www.fbi.gov/wanted",
        Origin: "https://www.fbi.gov",
      },
    },
  );

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.items ?? []).slice(0, limit).map((item) => ({
    id: `fbi-${item.uid || item.title}`,
    name: item.title || name,
    kind: "wanted",
    subtitle:
      (item.subjects || []).join(" · ") || "FBI wanted / seeking information",
    state: item.possible_states?.[0] || parsed.state,
    country: item.nationality || parsed.country || "US",
    details: [
      ...(item.description
        ? [
            {
              label: "Description",
              value: item.description.replace(/\s+/g, " ").slice(0, 280),
            },
          ]
        : []),
      ...(item.field_offices?.length
        ? [{ label: "Field office", value: item.field_offices.join(", ") }]
        : []),
      ...(item.reward_text
        ? [
            {
              label: "Reward",
              value: item.reward_text.replace(/<[^>]+>/g, "").slice(0, 200),
            },
          ]
        : []),
      ...(item.publication
        ? [{ label: "Published", value: item.publication }]
        : []),
    ],
    source: {
      id: "fbi-wanted",
      label: "FBI Wanted",
      jurisdiction: "US federal law enforcement",
      retrievedAt,
      deepLink: item.url || "https://www.fbi.gov/wanted",
      confidence: "high",
    },
  }));

  setCached(key, hits, SOURCE_LIMITS["fbi-wanted"].ttlMs);

  return hits;
}
