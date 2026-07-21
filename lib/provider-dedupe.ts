/**
 * Cross-gateway vendor dedupe for OSINT fan-out.
 *
 * Exact policy:
 * 1. One underlying vendor = one call path at a time (never CSINT ∥ BreachHub).
 * 2. Prefer BreachHub first for every mirrored vendor.
 * 3. If BreachHub fails / errors / returns empty for that vendor, fall back to
 *    CSINT.pro (or the direct client: OsintCat / Breach.vip / CordCat).
 * 4. Sequential primary → fallback only — never fire both at once.
 *
 * Vendor map (primary → fallback):
 * | Vendor                      | Primary     | Fallback                         |
 * |-----------------------------|-------------|----------------------------------|
 * | OathNet                     | BreachHub   | CSINT /oathnet/*                 |
 * | Snusbase                    | BreachHub   | CSINT /snusbase/* + /search      |
 * | LeakCheck                   | BreachHub   | CSINT /search (+ /leakcheck/v2)  |
 * | HackCheck                   | BreachHub   | CSINT /search (+ /hackcheck)     |
 * | Breach.vip                  | BreachHub   | direct breach.vip → CSINT /search|
 * | BreachBase                  | BreachHub   | CSINT /breachbase                |
 * | Shodan host                 | BreachHub   | CSINT /shodan/host               |
 * | Melissa                     | BreachHub   | CSINT /melissa/lookup            |
 * | SEON email / phone          | BreachHub   | CSINT /seon/*                    |
 * | OsintCat database / stalker | BreachHub   | direct OSINTCAT_API_KEY          |
 * | OsintCat twitter / machine  | BreachHub   | (no CSINT equivalent)            |
 * | CordCat                     | BreachHub   | direct CORDCAT_API_KEY           |
 * | IntelX export               | BreachHub   | CSINT → GodsEye                  |
 *
 * Within BreachHub only: always skip IntelBase * mirrors of direct BH vendors.
 */

import { isBreachVipEnabled } from "@/lib/breachvip";
import { isCordCatConfigured } from "@/lib/cordcat";
import { isCsintEnabled } from "@/lib/csint";
import { getOsintCatApiKey } from "@/lib/osintcat";

/** Always skip — mirrors a direct BreachHub catalog vendor in the same fan-out. */
const SKIP_INTELBASE_MIRRORS = [
  "intelbase-hackcheck",
  "intelbase-leakcheck",
  "intelbase-leakosint",
  "intelbase-breachvip",
  "intelbase-akula",
  "intelbase-leaksight",
  "intelbase-intelvault-breaches",
  "intelbase-intelvault-email",
  "intelbase-intelvault-username",
] as const;

export type ProviderDedupePrimary =
  | "breachhub"
  | "csint-fallback"
  | "osintcat-fallback"
  | "breachvip-fallback"
  | "cordcat-fallback";

export type VendorGatewayRow = {
  vendor: string;
  primary: "breachhub";
  fallback: "csint" | "direct-osintcat" | "direct-breachvip" | "direct-cordcat" | "none";
  notes?: string;
};

/** Static primary/fallback map for docs / health UI. */
export const VENDOR_GATEWAY_PRIMARIES: VendorGatewayRow[] = [
  {
    vendor: "OathNet",
    primary: "breachhub",
    fallback: "csint",
    notes: "BH first; CSINT only after BH fail/empty",
  },
  { vendor: "Snusbase", primary: "breachhub", fallback: "csint" },
  { vendor: "LeakCheck", primary: "breachhub", fallback: "csint" },
  { vendor: "HackCheck", primary: "breachhub", fallback: "csint" },
  {
    vendor: "Breach.vip",
    primary: "breachhub",
    fallback: "direct-breachvip",
    notes: "Then CSINT /search if direct also unavailable",
  },
  { vendor: "BreachBase", primary: "breachhub", fallback: "csint" },
  { vendor: "Shodan host", primary: "breachhub", fallback: "csint" },
  { vendor: "Melissa", primary: "breachhub", fallback: "csint" },
  { vendor: "SEON email/phone", primary: "breachhub", fallback: "csint" },
  {
    vendor: "OsintCat database/stalker",
    primary: "breachhub",
    fallback: "direct-osintcat",
  },
  {
    vendor: "OsintCat twitter/machine-viewer",
    primary: "breachhub",
    fallback: "none",
  },
  {
    vendor: "CordCat",
    primary: "breachhub",
    fallback: "direct-cordcat",
  },
  {
    vendor: "IntelX export",
    primary: "breachhub",
    fallback: "csint",
    notes: "GodsEye last resort after both",
  },
];

/** @deprecated Prefer VENDOR_GATEWAY_PRIMARIES — kept for older status tooling. */
export type ProviderOverlapRow = {
  vendor: string;
  primary: string;
  skippedBreachHubIds: readonly string[];
};

export const PROVIDER_OVERLAP_TABLE: ProviderOverlapRow[] =
  VENDOR_GATEWAY_PRIMARIES.map((row) => ({
    vendor: row.vendor,
    primary: `BreachHub → ${row.fallback}`,
    skippedBreachHubIds: [],
  }));

/** Env-only — avoid importing lib/breachhub (circular with this module). */
export function isBreachHubKeyConfigured(): boolean {
  if (process.env.BREACHHUB_ENABLED === "false") return false;

  return Boolean(process.env.BREACHHUB_API_KEY?.trim());
}

export function hasOsintCatDirect(): boolean {
  return Boolean(getOsintCatApiKey()?.trim());
}

/**
 * True when BreachHub is the live primary — CSINT additive / directs must not
 * run in parallel for mirrored vendors (use sequential fallback instead).
 */
export function isBreachHubPrimaryActive(): boolean {
  return isBreachHubKeyConfigured();
}

/**
 * CSINT additive fan-out should not run beside BreachHub for the same vendors.
 * Call CSINT only as fallback after BH fails/returns empty (see wrappers).
 */
export function shouldDeferCsintAdditive(): boolean {
  return isBreachHubPrimaryActive() && isCsintEnabled();
}

/** Direct OsintCat — only when BH is off (else BH primary, direct = fallback). */
export function shouldUseDirectOsintCatInParallel(): boolean {
  return hasOsintCatDirect() && !isBreachHubPrimaryActive();
}

/** Direct breach.vip — only when BH is off. */
export function shouldUseDirectBreachVip(): boolean {
  return isBreachVipEnabled() && !isBreachHubPrimaryActive();
}

/** Direct CordCat — only when BH is off. */
export function shouldUseDirectCordCatInParallel(): boolean {
  return isCordCatConfigured() && !isBreachHubPrimaryActive();
}

/**
 * Sequential primary → fallback. Never runs both at once.
 * Treats null / undefined / empty-count sanitized payloads as failure.
 */
export async function withPrimaryFallback<T>(
  primary: () => Promise<T | null | undefined>,
  fallback: () => Promise<T | null | undefined>,
  isSuccess: (value: T) => boolean = defaultIsSuccess,
): Promise<{ value: T | null; used: "primary" | "fallback" | "none" }> {
  try {
    const first = await primary();

    if (first != null && isSuccess(first)) {
      return { value: first, used: "primary" };
    }
  } catch {
    // fall through
  }

  try {
    const second = await fallback();

    if (second != null && isSuccess(second)) {
      return { value: second, used: "fallback" };
    }

    return { value: second ?? null, used: second != null ? "fallback" : "none" };
  } catch {
    return { value: null, used: "none" };
  }
}

function defaultIsSuccess(value: unknown): boolean {
  if (value == null) return false;

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (typeof record.count === "number") return record.count > 0;
    if (typeof record.content === "string") return record.content.trim().length > 0;
    if (Array.isArray(record.results)) return record.results.length > 0;
  }

  return true;
}

/**
 * BreachHub endpoint ids to skip for the current env.
 * Only IntelBase intra-BH mirrors — never drop BH vendors that CSINT also has.
 * OathNet `/api/oathnet/*` ids are never skipped (BH is primary; CSINT is fallback).
 */
export function getSkippedBreachHubEndpointIds(): Set<string> {
  return new Set<string>(SKIP_INTELBASE_MIRRORS);
}

export function shouldSkipBreachHubEndpoint(endpointId: string): boolean {
  return getSkippedBreachHubEndpointIds().has(endpointId);
}

export function filterBreachHubEndpoints<T extends { id: string }>(
  endpoints: T[],
): T[] {
  const skipped = getSkippedBreachHubEndpointIds();

  return endpoints.filter((endpoint) => !skipped.has(endpoint.id));
}

export function filterBreachHubEndpointIds(ids: string[]): string[] {
  const skipped = getSkippedBreachHubEndpointIds();

  return ids.filter((id) => !skipped.has(id));
}

/** Active gateway roles for health / diagnostics. */
export function activeProviderPrimaries(): ProviderDedupePrimary[] {
  const out: ProviderDedupePrimary[] = [];

  if (isBreachHubPrimaryActive()) out.push("breachhub");
  if (isCsintEnabled()) out.push("csint-fallback");
  if (hasOsintCatDirect()) out.push("osintcat-fallback");
  if (isBreachVipEnabled()) out.push("breachvip-fallback");
  if (isCordCatConfigured()) out.push("cordcat-fallback");

  return out;
}
