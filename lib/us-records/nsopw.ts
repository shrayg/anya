import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  fetchUsRecordsPostJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

const US_JURISDICTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "AS", "GU", "MP", "PR", "VI",
];

type NsopwOffender = {
  offenderId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  age?: string | number;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
};

type NsopwResponse = {
  offenders?: NsopwOffender[];
  statusCode?: number;
  message?: string;
};

function resolveJurisdictions(parsed: ParsedPublicQuery): string[] {
  if (parsed.state) return [parsed.state.toUpperCase()];
  return US_JURISDICTIONS;
}

export async function searchNsopw(
  parsed: ParsedPublicQuery,
  limit = 15,
): Promise<PersonHit[]> {
  if (!parsed.firstName || !parsed.lastName) {
    throw new Error(
      "National Sex Offender Registry requires first and last name (e.g. John Smith, VA).",
    );
  }

  const jurisdictions = resolveJurisdictions(parsed);
  const key = cacheKey(
    "nsopw",
    `${parsed.firstName}:${parsed.lastName}:${jurisdictions.join(",")}:${parsed.zip || ""}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const body: Record<string, unknown> = {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    clientIp: "",
    jurisdictions,
  };
  if (parsed.zip) body.zips = [parsed.zip];
  if (parsed.city) body.city = parsed.city;
  if (parsed.county) body.county = parsed.county;

  const data = await fetchUsRecordsPostJson<NsopwResponse>(
    "https://nsopw-api.ojp.gov/nsopw/v1/v1.0/search",
    {
      source: "nsopw",
      minIntervalMs: 2000,
      userAgent: BROWSER_UA,
      headers: {
        Origin: "https://www.nsopw.gov",
        Referer: "https://www.nsopw.gov/search-public-sex-offender-registries",
      },
      body,
    },
  );

  if (data.statusCode && data.statusCode > 200) {
    throw new Error(data.message || `NSOPW status ${data.statusCode}`);
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.offenders ?? []).slice(0, limit).map((row, index) => {
    const name =
      row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || parsed.fullName || "";
    const location = [row.address, row.city, row.state, row.zip].filter(Boolean).join(", ");
    return {
      id: `nsopw-${row.offenderId || index}`,
      name,
      kind: "sex-offender",
      subtitle: row.age != null ? `Age ${row.age}` : "National SOR match",
      state: row.state || parsed.state,
      country: "US",
      details: [
        ...(row.age != null ? [{ label: "Age", value: String(row.age) }] : []),
        ...(location ? [{ label: "Location", value: location }] : []),
        { label: "Jurisdictions searched", value: jurisdictions.slice(0, 8).join(", ") + (jurisdictions.length > 8 ? "…" : "") },
      ],
      source: {
        id: "nsopw",
        label: "NSOPW (National SOR)",
        jurisdiction: "US state & territory sex offender registries",
        retrievedAt,
        deepLink: "https://www.nsopw.gov/search-public-sex-offender-registries",
        confidence: "high",
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS.nsopw.ttlMs);
  return hits;
}
