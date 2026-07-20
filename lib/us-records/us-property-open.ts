import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type PlutoRow = {
  ownername?: string;
  address?: string;
  borough?: string;
  zipcode?: string;
  bbl?: string;
  assesstot?: string | number;
};

type AcrisParty = {
  document_id?: string;
  name?: string;
  address_1?: string;
  city?: string;
  state?: string;
  zip?: string;
  party_type?: string;
};

type PhillyRow = {
  owner_1?: string;
  location?: string;
  market_value?: number;
  parcel_number?: string;
  zip_code?: string;
};

export function shouldSearchNycProperty(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "NY") return false;
  if (parsed.state === "NY") return true;

  return /\b(nyc|new york|brooklyn|manhattan|queens|bronx|acris|pluto)\b/i.test(
    parsed.raw,
  );
}

export function shouldSearchPhillyOpa(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "PA") return false;
  if (/\b(philadelphia|philly|opa)\b/i.test(parsed.raw)) return true;

  return parsed.state === "PA" && Boolean(queryNeedle(parsed));
}

export async function searchNycPluto(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("nyc-pluto", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const where = `upper(ownername) like '%${needle.replace(/'/g, "''").toUpperCase()}%'`;
  const url =
    `https://data.cityofnewyork.us/resource/64uk-42ks.json?` +
    new URLSearchParams({
      $select: "ownername,address,borough,zipcode,bbl,assesstot",
      $where: where,
      $limit: String(Math.min(limit * 3, 30)),
    }).toString();

  const rows = await fetchUsRecordsJson<PlutoRow[]>(url, {
    source: "nyc-pluto",
    minIntervalMs: 400,
  });
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (rows || [])
    .map((row) => ({
      row,
      score: scoreNameMatch(row.ownername || "", needle),
    }))
    .filter((r) => r.row.ownername && r.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `nyc-pluto-${row.bbl || row.ownername}`.slice(0, 180),
      name: row.ownername || needle,
      kind: "property",
      subtitle: [row.address, row.borough, row.zipcode]
        .filter(Boolean)
        .join(" · "),
      state: "NY",
      country: "US",
      details: [
        ...(row.address ? [{ label: "Address", value: row.address }] : []),
        ...(row.borough ? [{ label: "Borough", value: row.borough }] : []),
        ...(row.bbl ? [{ label: "BBL", value: String(row.bbl) }] : []),
        ...(row.assesstot
          ? [{ label: "Assessed total", value: String(row.assesstot) }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "nyc-pluto",
        label: "NYC PLUTO Property",
        jurisdiction: "New York City",
        retrievedAt,
        deepLink: "https://property.cityofnewyork.us/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["nyc-pluto"].ttlMs);

  return hits;
}

export async function searchNycAcris(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("nyc-acris", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const where = `upper(name) like '%${needle.replace(/'/g, "''").toUpperCase()}%'`;
  const url =
    `https://data.cityofnewyork.us/resource/636b-3b5g.json?` +
    new URLSearchParams({
      $where: where,
      $limit: String(Math.min(limit * 3, 30)),
    }).toString();

  const rows = await fetchUsRecordsJson<AcrisParty[]>(url, {
    source: "nyc-acris",
    minIntervalMs: 400,
  });
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const hits: PersonHit[] = [];

  for (const row of rows || []) {
    const name = (row.name || "").trim();

    if (!name) continue;
    const score = scoreNameMatch(name, needle);

    if (score < 45) continue;
    const id = `${row.document_id || ""}-${name}`;

    if (seen.has(id)) continue;
    seen.add(id);
    hits.push({
      id: `nyc-acris-${id}`.slice(0, 180),
      name,
      kind: "property",
      subtitle: "NYC ACRIS recorded party",
      state: "NY",
      country: "US",
      details: [
        ...(row.document_id
          ? [{ label: "Document ID", value: row.document_id }]
          : []),
        ...(row.address_1 ? [{ label: "Address", value: row.address_1 }] : []),
        ...(row.city ? [{ label: "City", value: row.city }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "nyc-acris",
        label: "NYC ACRIS",
        jurisdiction: "New York City",
        retrievedAt,
        deepLink: "https://a836-acris.nyc.gov/CP/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["nyc-acris"].ttlMs);

  return hits;
}

export async function searchPhillyOpa(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("philly-opa", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const safe = needle.replace(/'/g, "''");
  const url =
    `https://phl.carto.com/api/v2/sql?q=` +
    encodeURIComponent(
      `SELECT owner_1, location, market_value, parcel_number, zip_code FROM opa_properties_public WHERE owner_1 ILIKE '%${safe}%' LIMIT ${Math.min(limit * 3, 30)}`,
    );

  const data = await fetchUsRecordsJson<{ rows?: PhillyRow[] }>(url, {
    source: "philly-opa",
    minIntervalMs: 400,
  });
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.rows || [])
    .map((row) => ({
      row,
      score: scoreNameMatch(row.owner_1 || "", needle),
    }))
    .filter((r) => r.row.owner_1 && r.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `philly-opa-${row.parcel_number || row.owner_1}`.slice(0, 180),
      name: row.owner_1 || needle,
      kind: "property",
      subtitle: [row.location, row.zip_code].filter(Boolean).join(" · "),
      state: "PA",
      country: "US",
      details: [
        ...(row.location ? [{ label: "Address", value: row.location }] : []),
        ...(row.parcel_number
          ? [{ label: "OPA parcel", value: row.parcel_number }]
          : []),
        ...(row.market_value != null
          ? [{ label: "Market value", value: String(row.market_value) }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "philly-opa",
        label: "Philadelphia OPA",
        jurisdiction: "Philadelphia, PA",
        retrievedAt,
        deepLink: "https://property.phila.gov/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["philly-opa"].ttlMs);

  return hits;
}

type KaneFeature = {
  attributes?: {
    PIN?: string;
    TaxName?: string;
    SiteAddress?: string;
  };
};

type KaneResponse = {
  features?: KaneFeature[];
};

export function shouldSearchKaneIlProperty(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "IL") return false;
  if (/\b(kane|geneva|elgin|aurora|st\.?\s*charles)\b/i.test(parsed.raw)) {
    return true;
  }

  return (
    parsed.state === "IL" &&
    Boolean(parsed.county && /kane/i.test(parsed.county))
  );
}

/**
 * Kane County, IL parcel owner lookup via public ArcGIS REST (TaxName).
 * Cook County open layers omit owner — catalogued separately as portal-only.
 */
export async function searchKaneIlProperty(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("kane-il-property", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const url =
    "https://gistech.countyofkane.org/arcgis/rest/services/KanePINList/MapServer/0/query?" +
    new URLSearchParams({
      where: `UPPER(TaxName) LIKE UPPER('%${needle.replace(/'/g, "''")}%')`,
      outFields: "PIN,TaxName,SiteAddress",
      returnGeometry: "false",
      f: "json",
      resultRecordCount: String(Math.min(limit * 3, 30)),
    }).toString();

  const data = await fetchUsRecordsJson<KaneResponse>(url, {
    source: "kane-il-property",
    minIntervalMs: 400,
  });
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.features || [])
    .map((feature) => {
      const row = feature.attributes || {};

      return {
        row,
        score: scoreNameMatch(row.TaxName || "", needle),
      };
    })
    .filter((r) => r.row.TaxName && r.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: `kane-il-${row.PIN || row.TaxName}`.slice(0, 180),
      name: row.TaxName || needle,
      kind: "property" as const,
      subtitle: [row.SiteAddress, "Kane County, IL"]
        .filter(Boolean)
        .join(" · "),
      state: "IL",
      country: "US",
      details: [
        ...(row.SiteAddress
          ? [{ label: "Address", value: row.SiteAddress }]
          : []),
        ...(row.PIN ? [{ label: "PIN", value: row.PIN }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "kane-il-property" as const,
        label: "Kane County IL Assessor",
        jurisdiction: "Kane County, IL",
        retrievedAt,
        deepLink: "https://www.kanecountyassessor.net/",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["kane-il-property"].ttlMs);

  return hits;
}
