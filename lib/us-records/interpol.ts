import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

type InterpolNotice = {
  entity_id?: string;
  forename?: string;
  name?: string;
  date_of_birth?: string;
  nationalities?: string[];
  _links?: { self?: { href?: string }; thumbnail?: { href?: string } };
};

type InterpolResponse = {
  total?: number;
  _embedded?: { notices?: InterpolNotice[] };
};

export async function searchInterpolRedNotices(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const forename = parsed.firstName || "";
  const name = parsed.lastName || parsed.fullName?.split(" ").slice(-1)[0] || "";
  if (!forename && !name) return [];

  const key = cacheKey("interpol", `${forename}:${name}:${limit}`);
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    resultPerPage: String(Math.min(limit, 20)),
  });
  if (forename) params.set("forename", forename);
  if (name) params.set("name", name);
  if (parsed.country && parsed.country.length === 2) {
    params.set("nationality", parsed.country.toUpperCase());
  }

  const data = await fetchUsRecordsJson<InterpolResponse>(
    `https://ws-public.interpol.int/notices/v1/red?${params}`,
    {
      source: "interpol",
      minIntervalMs: 1200,
      userAgent: BROWSER_UA,
      headers: { Referer: "https://www.interpol.int/" },
    },
  );

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data._embedded?.notices ?? []).slice(0, limit).map((row) => {
    const fullName = [row.forename, row.name].filter(Boolean).join(" ") || parsed.fullName || "Unknown";
    return {
      id: `interpol-${row.entity_id || fullName}`,
      name: fullName,
      kind: "wanted",
      subtitle: "Interpol Red Notice",
      country: row.nationalities?.[0] || parsed.country,
      details: [
        ...(row.date_of_birth ? [{ label: "Date of birth", value: row.date_of_birth }] : []),
        ...(row.nationalities?.length
          ? [{ label: "Nationalities", value: row.nationalities.join(", ") }]
          : []),
      ],
      source: {
        id: "interpol",
        label: "Interpol Red Notices",
        jurisdiction: "International criminal police cooperation",
        retrievedAt,
        deepLink: row._links?.self?.href || "https://www.interpol.int/How-we-work/Notices/View-Red-Notices",
        confidence: "high",
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS.interpol.ttlMs);
  return hits;
}
