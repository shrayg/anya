/**
 * Toggleable sources inside the unified Public Records module.
 * Defaults are all ON — users narrow via Options next to Search.
 */

export const PUBLIC_RECORDS_SOURCE_OPTIONS = [
  {
    id: "identity",
    label: "Identity & federal registries",
    description: "FEC, NPI, licenses, property, business, and related indexes",
  },
  {
    id: "court",
    label: "Court Records",
    description: "Federal RECAP and live state/county court adapters",
  },
  {
    id: "sanctions",
    label: "Sanctions & Watchlists",
    description: "OFAC, UN, OpenSanctions, SAM.gov, and allied lists",
  },
  {
    id: "wanted",
    label: "Wanted Persons",
    description: "FBI, Interpol, DEA, USMS, and county wanted indexes",
  },
  {
    id: "national-sor",
    label: "National Sex Offender Registry",
    description: "NSOPW national + Canada RCMP high-risk SOR",
  },
  {
    id: "va-sor",
    label: "VA Sex Offender Registry",
    description: "Virginia State Police registry (and NSOPW scoped to VA)",
  },
  {
    id: "state-directory",
    label: "US State Records Directory",
    description: "Official court and SOR portal links for all 50 states + DC",
  },
  {
    id: "portal-backlog",
    label: "Portal Adapter Backlog",
    description: "Prioritized government portals queued for live adapters",
  },
  {
    id: "intl-directory",
    label: "International Records Directory",
    description: "Court, business registry, and sanctions portals by country",
  },
  {
    id: "breaches",
    label: "Breach & leak indexes",
    description: "Name-matched breach / leak credentials from connected indexes",
  },
  {
    id: "contact-enrich",
    label: "Contact enrichment",
    description: "Public contact / address enrichment when available",
  },
] as const;

export type PublicRecordsSourceOptionId =
  (typeof PUBLIC_RECORDS_SOURCE_OPTIONS)[number]["id"];

export const DEFAULT_PUBLIC_RECORDS_SOURCES: PublicRecordsSourceOptionId[] =
  PUBLIC_RECORDS_SOURCE_OPTIONS.map((option) => option.id);

export const PUBLIC_RECORDS_SOURCE_IDS = new Set<string>(
  DEFAULT_PUBLIC_RECORDS_SOURCES,
);

export function parsePublicRecordsSources(
  raw: string | null | undefined,
): PublicRecordsSourceOptionId[] {
  if (!raw?.trim()) return [...DEFAULT_PUBLIC_RECORDS_SOURCES];

  const selected = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is PublicRecordsSourceOptionId =>
      PUBLIC_RECORDS_SOURCE_IDS.has(part),
    );

  return selected.length > 0 ? selected : [...DEFAULT_PUBLIC_RECORDS_SOURCES];
}

/** Legacy sidebar slugs folded into unified Public Records. */
export const LEGACY_PUBLIC_RECORDS_SLUGS = [
  "global-public-records",
  "court-records",
  "identity-search",
  "npd-search",
  "sanctions-watchlists",
  "wanted-persons",
  "national-sor",
  "va-sex-offender",
  "state-records-directory",
  "portal-backlog",
  "international-records-directory",
] as const;

export function isLegacyPublicRecordsSlug(slug: string): boolean {
  return (LEGACY_PUBLIC_RECORDS_SLUGS as readonly string[]).includes(slug);
}
