import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { BROWSER_UA, SOURCE_LIMITS } from "@/lib/us-records/robots-and-limits";

const US_JURISDICTIONS = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "AS",
  "GU",
  "MP",
  "PR",
  "VI",
];

type NsopwName = {
  givenName?: string;
  middleName?: string;
  surName?: string;
};

type NsopwLocation = {
  name?: string;
  type?: string;
  city?: string;
  county?: string;
  state?: string;
  zipCode?: string | null;
};

type NsopwOffender = {
  name?: NsopwName | string;
  aliases?: NsopwName[];
  gender?: string;
  age?: string | number;
  locations?: NsopwLocation[];
  offenderUri?: string;
  imageUri?: string;
  absconder?: boolean;
  jurisdictionId?: string;
  offenderId?: string;
};

type NsopwResponse = {
  offenders?: NsopwOffender[];
  statusCode?: number;
  message?: string;
  jurisdictionStatus?: Array<{
    jurisdictionId?: string;
    statusCode?: string;
    records?: number;
  }>;
};

function formatName(name?: NsopwName | string): string {
  if (!name) return "";
  if (typeof name === "string") return name.trim();

  return [name.givenName, name.middleName, name.surName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveJurisdictions(parsed: ParsedPublicQuery): string[] {
  if (parsed.state) return [parsed.state.toUpperCase()];

  // ZIP-only searches still need jurisdictions; API rejects oversized batches.
  return US_JURISDICTIONS;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

async function loadGotScraping() {
  const mod = await import("got-scraping");

  return mod.gotScraping;
}

async function postNsopwSearch(
  body: Record<string, unknown>,
): Promise<NsopwResponse> {
  const gotScraping = await loadGotScraping();
  const res = await gotScraping({
    url: "https://nsopw-api.ojp.gov/nsopw/v1/v1.0/search",
    method: "POST",
    json: body,
    headerGeneratorOptions: {
      browsers: ["chrome"],
      operatingSystems: ["windows"],
    },
    headers: {
      Accept: "application/json",
      Origin: "https://www.nsopw.gov",
      Referer: "https://www.nsopw.gov/?AspxAutoDetectCookieSupport=1",
      "User-Agent": BROWSER_UA,
    },
    responseType: "json",
    timeout: { request: SOURCE_LIMITS.nsopw.timeoutMs },
  });

  if (res.statusCode >= 400) {
    throw new Error(`NSOPW HTTP ${res.statusCode}`);
  }

  const data = res.body as NsopwResponse;

  if (typeof data.statusCode === "number" && data.statusCode >= 400) {
    throw new Error(data.message || `NSOPW status ${data.statusCode}`);
  }

  return data;
}

/**
 * Dru Sjodin National Sex Offender Public Website (NSOPW).
 * Twin: POST nsopw-api.ojp.gov (Cloudflare — use got-scraping).
 * Filters: first+last required OR zip; optional state/city/county/zip narrows results.
 * Without a state, jurisdictions are queried in batches (API rejects full 56-pack).
 */
export async function searchNsopw(
  parsed: ParsedPublicQuery,
  limit = 15,
): Promise<PersonHit[]> {
  if (parsed.country && parsed.country !== "US") return [];

  const hasName = Boolean(parsed.firstName && parsed.lastName);
  const hasZip = Boolean(parsed.zip);

  if (!hasName && !hasZip) {
    throw new Error(
      "NSOPW requires first and last name, or a ZIP code (e.g. John Smith, VA — or 23220).",
    );
  }

  const jurisdictions = resolveJurisdictions(parsed);
  const key = cacheKey(
    "nsopw",
    `${parsed.firstName || ""}:${parsed.lastName || ""}:${jurisdictions.join(",")}:${parsed.city || ""}:${parsed.county || ""}:${parsed.zip || ""}:${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const baseBody: Record<string, unknown> = {
    firstName: parsed.firstName || "",
    lastName: parsed.lastName || "",
    clientIp: "",
  };

  if (parsed.zip) baseBody.zips = [parsed.zip];
  if (parsed.city) baseBody.city = parsed.city;
  if (parsed.county) {
    baseBody.county = parsed.county.replace(/\s+County$/i, "").trim();
  }

  const batches =
    jurisdictions.length <= 12 ? [jurisdictions] : chunk(jurisdictions, 10);

  const offenders: NsopwOffender[] = [];
  const seen = new Set<string>();
  let lastError: Error | null = null;

  for (const batch of batches) {
    if (offenders.length >= limit) break;
    try {
      const data = await postNsopwSearch({
        ...baseBody,
        jurisdictions: batch,
      });

      for (const row of data.offenders ?? []) {
        const id = row.offenderId || row.offenderUri || formatName(row.name);

        if (!id || seen.has(id)) continue;
        seen.add(id);
        offenders.push(row);
        if (offenders.length >= limit) break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Continue other batches; surface error only if nothing collected.
    }
  }

  if (!offenders.length && lastError) throw lastError;

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = offenders.slice(0, limit).map((row, index) => {
    const name =
      formatName(row.name) ||
      formatName(row.aliases?.[0]) ||
      parsed.fullName ||
      "Unknown";
    const primary =
      row.locations?.find((loc) => loc.type === "R") || row.locations?.[0];
    const location = [
      primary?.city,
      primary?.county,
      primary?.state || row.jurisdictionId,
      primary?.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
    const aliases = (row.aliases || [])
      .map((alias) => formatName(alias))
      .filter(Boolean)
      .slice(0, 4);

    return {
      id: `nsopw-${row.offenderId || row.offenderUri || index}`,
      name,
      kind: "sex-offender" as const,
      subtitle:
        [
          row.age != null ? `Age ${row.age}` : null,
          row.absconder ? "Absconder" : null,
          row.jurisdictionId,
        ]
          .filter(Boolean)
          .join(" · ") || "National SOR match",
      state: primary?.state || row.jurisdictionId || parsed.state,
      country: "US",
      details: [
        ...(row.age != null ? [{ label: "Age", value: String(row.age) }] : []),
        ...(row.gender ? [{ label: "Gender", value: row.gender }] : []),
        ...(location ? [{ label: "Location", value: location }] : []),
        ...(aliases.length
          ? [{ label: "Aliases", value: aliases.join("; ") }]
          : []),
        ...(row.absconder ? [{ label: "Absconder", value: "Yes" }] : []),
        {
          label: "Jurisdictions searched",
          value:
            jurisdictions.slice(0, 8).join(", ") +
            (jurisdictions.length > 8 ? "…" : ""),
        },
      ],
      source: {
        id: "nsopw" as const,
        label: "NSOPW (National SOR)",
        jurisdiction: "US state & territory sex offender registries",
        retrievedAt,
        deepLink:
          row.offenderUri ||
          "https://www.nsopw.gov/?AspxAutoDetectCookieSupport=1",
        confidence: "high" as const,
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS.nsopw.ttlMs);

  return hits;
}
