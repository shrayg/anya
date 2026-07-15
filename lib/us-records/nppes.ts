import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

const NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/";

type NppesAddress = {
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
  address_purpose?: string;
};

type NppesResult = {
  number?: string | number;
  enumeration_type?: string;
  basic?: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
    sole_proprietor?: string;
    gender?: string;
    status?: string;
  };
  taxonomies?: Array<{ desc?: string; primary?: boolean; state?: string; license?: string }>;
  addresses?: NppesAddress[];
};

type NppesResponse = {
  result_count?: number;
  results?: NppesResult[];
};

function pickAddress(addresses: NppesAddress[] | undefined): NppesAddress | undefined {
  if (!addresses?.length) return undefined;
  return (
    addresses.find((row) => row.address_purpose === "LOCATION") ||
    addresses.find((row) => row.address_purpose === "MAILING") ||
    addresses[0]
  );
}

export async function searchNppes(
  parsed: ParsedUsQuery,
  limit = 8,
): Promise<PersonHit[]> {
  if (!parsed.lastName && !parsed.fullName) return [];

  const key = cacheKey(
    "nppes",
    `${parsed.firstName ?? ""}:${parsed.lastName ?? parsed.fullName}:${parsed.state ?? ""}:${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    version: "2.1",
    limit: String(Math.min(limit, 20)),
  });

  if (parsed.firstName && parsed.lastName) {
    params.set("first_name", parsed.firstName);
    params.set("last_name", parsed.lastName);
  } else if (parsed.lastName) {
    params.set("last_name", parsed.lastName);
  } else if (parsed.fullName) {
    const parts = parsed.fullName.split(/\s+/);
    if (parts.length >= 2) {
      params.set("first_name", parts[0]);
      params.set("last_name", parts.slice(1).join(" "));
    } else {
      params.set("last_name", parsed.fullName);
    }
  }

  if (parsed.state) params.set("state", parsed.state);

  let data = await fetchUsRecordsJson<NppesResponse>(
    `${NPPES_BASE}?${params}`,
    { source: "nppes", minIntervalMs: 200 },
  );

  // Broaden when exact first+last is empty (registry spelling variants).
  if ((!data.results || data.results.length === 0) && parsed.firstName && parsed.lastName) {
    const fallback = new URLSearchParams({
      version: "2.1",
      limit: String(Math.min(limit, 20)),
      last_name: parsed.lastName,
    });
    if (parsed.state) fallback.set("state", parsed.state);
    data = await fetchUsRecordsJson<NppesResponse>(`${NPPES_BASE}?${fallback}`, {
      source: "nppes",
      minIntervalMs: 200,
    });
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.results ?? []).slice(0, limit).map((row, index) => {
    const basic = row.basic ?? {};
    const name =
      basic.organization_name ||
      [basic.first_name, basic.last_name].filter(Boolean).join(" ") ||
      parsed.fullName ||
      "Unknown provider";
    const primaryTaxonomy =
      row.taxonomies?.find((tax) => tax.primary)?.desc ||
      row.taxonomies?.[0]?.desc;
    const address = pickAddress(row.addresses);
    const npi = String(row.number ?? `nppes-${index}`);
    const location = [
      address?.address_1,
      address?.city,
      address?.state,
      address?.postal_code,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      id: npi,
      name,
      kind: "provider",
      subtitle: [primaryTaxonomy, basic.credential].filter(Boolean).join(" · ") || undefined,
      state: address?.state || parsed.state,
      details: [
        { label: "NPI", value: npi },
        ...(basic.status ? [{ label: "Status", value: basic.status }] : []),
        ...(primaryTaxonomy ? [{ label: "Taxonomy", value: primaryTaxonomy }] : []),
        ...(location ? [{ label: "Practice address", value: location }] : []),
        ...(address?.telephone_number
          ? [{ label: "Phone", value: address.telephone_number }]
          : []),
      ],
      source: {
        id: "nppes",
        label: "CMS NPPES NPI Registry",
        jurisdiction: "US healthcare providers",
        retrievedAt,
        deepLink: `https://npiregistry.cms.hhs.gov/provider-view/${npi}`,
        confidence: "high",
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS.nppes.ttlMs);
  return hits;
}
