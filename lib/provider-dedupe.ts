/**
 * Cross-gateway vendor dedupe for OSINT fan-out.
 *
 * Exact policy (specialty routes — Shodan, Melissa, IntelX, stealer, …):
 * 1. One underlying vendor = one call path at a time (never CSINT ∥ BreachHub).
 * 2. Prefer BreachHub first for every mirrored vendor.
 * 3. If BreachHub fails / errors / returns empty for that vendor, fall back to
 *    CSINT.pro (or the direct client: OsintCat / Breach.vip / CordCat).
 * 4. Sequential primary → fallback only — never fire both at once.
 *
 * Breaches (/api/osint/breaches): Comb + GodsEye + BreachVIP + BreachHub run
 * in parallel (streamed partials). CSINT runs after BreachHub only when BH is
 * empty/thin or BH is off — not always-additive parallel with BH.
 *
 * Vendor map (primary → fallback):
 * | Vendor                      | Primary     | Fallback                         |
 * |-----------------------------|-------------|----------------------------------|
 * | OathNet                     | BreachHub   | CSINT /oathnet/*                 |
 * | Snusbase                    | BreachHub   | direct SNUSBASE_API_KEY → CSINT  |
 * | LeakCheck                   | BreachHub   | CSINT /search (+ /leakcheck/v2)  |
 * | HackCheck                   | BreachHub   | CSINT /search (+ /hackcheck)     |
 * | Breach.vip                  | BreachHub   | direct breach.vip → CSINT /search|
 * | BreachBase                  | BreachHub   | CSINT /breachbase                |
 * | Shodan host                 | BreachHub   | CSINT /shodan/host               |
 * | Melissa                     | BreachHub   | CSINT /melissa/lookup            |
 * | SEON email / phone / IP / BIN (SEON_API_KEY)          | BreachHub   | CSINT /seon/*                    |
 * | OsintCat database / stalker | BreachHub   | direct OSINTCAT_API_KEY          |
 * | OsintCat twitter / machine  | BreachHub   | (no CSINT equivalent)            |
 * | CordCat                     | BreachHub   | direct CORDCAT_API_KEY           |
 * | Seekria                     | BreachHub   | direct SEEKRIA_API_KEY           |
 * | Seekria Snusbase/LeakCheck  | specialty   | not additive (avoid double-hit)  |
 * | IntelX System ID (UUID)     | BreachHub   | CSINT → GodsEye                  |
 * | IntelX Storage ID (hex)     | CSINT       | BreachHub → GodsEye              |
 * | IntelVault                  | Direct key  | BreachHub /api/intelvault*       |
 * | SeekNow                     | Direct key  | BreachHub /api/seeknow/*         |
 * | Room101                     | Direct key  | BreachHub /api/room101/*         |
 * | Wentyn                      | BreachHub   | direct WENTYN_API_KEY (site route)|
 * | Telegram                    | BreachHub   | direct TELEGRAM_API_KEY (site route)|
 * | Reconly                     | BreachHub   | direct RECONLY_API_KEY (site route)|
 * | NBRS                        | Direct key  | BreachHub /api/nbrs/roblox       |
 * | Memory.lol                  | BreachHub   | direct MEMORY_API_KEY (site route)|
 * | LeakSight                   | BreachHub   | direct LEAKSIGHT_API_KEY (site route)|
 * | Inf0sec                     | BreachHub   | direct INF0SEC_API_KEY (site route)|
 * | Checko                      | BreachHub   | direct CHECKO_API_KEY (site route)|
 *
 * Within BreachHub only: always skip IntelBase * mirrors of direct BH vendors.
 * When INTELVAULT_API_KEY is set, also skip BH IntelVault catalog ids.
 * When SEEKNOW_API_KEY is set, skip BH SeekNow catalog ids (direct owns vendor).
 * When ROOM101_API_KEY is set, skip BH Room101 catalog ids (direct owns vendor).
 * When NBRS_API_KEY is set, skip BH nbrs-roblox (direct owns vendor).
 */

import { isBreachVipEnabled } from "@/lib/breachvip";
import { isCordCatConfigured } from "@/lib/cordcat";
import { isCsintEnabled } from "@/lib/csint";
import { getOsintCatApiKey } from "@/lib/osintcat";
import { hasSnusbaseDirect } from "@/lib/snusbase";

/** Env-only — avoid importing lib/seeknow (pulls breachhub → circular). */
function hasDirectSeekNowKeyEnv(): boolean {
  if (process.env.SEEKNOW_ENABLED === "false") return false;

  return Boolean(process.env.SEEKNOW_API_KEY?.trim());
}

/** Env-only — avoid importing lib/room101 (pulls breachhub → circular). */
function hasDirectRoom101KeyEnv(): boolean {
  if (process.env.ROOM101_ENABLED === "false") return false;

  return Boolean(process.env.ROOM101_API_KEY?.trim());
}

/** Env-only - avoid importing lib/nbrs (pulls breachhub -> circular). */
function hasDirectNbrsKeyEnv(): boolean {
  if (process.env.NBRS_ENABLED === "false") return false;

  return Boolean(process.env.NBRS_API_KEY?.trim());
}

const SKIP_SEEKNOW_WHEN_DIRECT = [
  "seeknow-search",
  "seeknow-stealer",
  "seeknow-stealer-legacy",
  "seeknow-discord-user",
  "seeknow-discord-roblox",
  "seeknow-github",
  "seeknow-twitter",
  "seeknow-tiktok",
  "seeknow-reddit",
  "seeknow-social",
  "seeknow-history",
  "seeknow-ip",
  "seeknow-email-check",
  "seeknow-phone",
  "seeknow-domain-intel",
  "seeknow-domain-whois",
  "seeknow-xbox",
  "seeknow-roblox",
  "seeknow-minecraft",
] as const;

const SKIP_ROOM101_WHEN_DIRECT = [
  "room101-user",
  "room101-analyze",
  "room101-search-legacy",
  "room101-search",
  "room101-subreddit",
] as const;

const SKIP_NBRS_WHEN_DIRECT = ["nbrs-roblox"] as const;

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
  { vendor: "Snusbase", primary: "breachhub", fallback: "csint", notes: "Direct SNUSBASE_API_KEY before CSINT when set" },
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
  { vendor: "SEON email/phone/IP/BIN (SEON_API_KEY)", primary: "breachhub", fallback: "csint" },
  {
    vendor: "OsintCat database/stalker",
    primary: "breachhub",
    fallback: "direct-osintcat",
  },
  {
    vendor: "OsintCat twitter/machine-viewer",
    primary: "breachhub",
    fallback: "direct-osintcat",
    notes: "Direct OSINTCAT_API_KEY via /api/osintcat/* when BH miss/unavailable",
  },
  {
    vendor: "CordCat",
    primary: "breachhub",
    fallback: "direct-cordcat",
  },
  {
    vendor: "Seekria",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Direct SEEKRIA_API_KEY when set; Seekria snusbase/leakcheck specialty-only (not additive beside BH snusbase/leakcheck)",
  },
  {
    vendor: "IntelX export",
    primary: "breachhub",
    fallback: "csint",
    notes:
      "UUID System ID → BH system_id first; Storage ID → CSINT first then BH; GodsEye last",
  },
  {
    vendor: "SeekNow",
    primary: "breachhub",
    fallback: "none",
    notes: "Direct SEEKNOW_API_KEY owns vendor; else BreachHub /api/seeknow/*",
  },
  {
    vendor: "Room101",
    primary: "breachhub",
    fallback: "csint",
    notes:
      "Direct ROOM101_API_KEY owns vendor; else BreachHub /api/room101/*; CSINT /reddit after BH miss",
  },
  {
    vendor: "Wentyn",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Additive fan-out via BreachHub /api/wentyn; optional WENTYN_API_KEY for GET /api/wentyn",
  },
  {
    vendor: "Telegram",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Specialty /api/telegram/{username|id|phone}; optional TELEGRAM_API_KEY else BreachHub proxy",
  },
  {
    vendor: "Memory.lol",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Specialty via BreachHub /api/memory; optional MEMORY_API_KEY for GET /api/memory",
  },
  {
    vendor: "Reconly",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Additive fan-out via BreachHub /api/reconly; optional RECONLY_API_KEY for GET /api/reconly",
  },
  {
    vendor: "LeakSight",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Additive fan-out via BreachHub /api/leaksight; optional LEAKSIGHT_API_KEY for GET /api/leaksight (no CSINT mirror; intelbase-leaksight always skipped)",
  },
  {
    vendor: "Inf0sec",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Additive fan-out via BreachHub /api/inf0sec; optional INF0SEC_API_KEY for GET /api/inf0sec",
  },
  {
    vendor: "NBRS",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Direct NBRS_API_KEY owns vendor; else BreachHub /api/nbrs/roblox; site GET /api/nbrs/roblox",
  },
  {
    vendor: "Checko",
    primary: "breachhub",
    fallback: "none",
    notes:
      "Specialty via BreachHub /api/checko; optional CHECKO_API_KEY for GET /api/checko (native api.checko.ru /v2/company)",
  },
];

/** Direct Snusbase — skip CSINT /snusbase/* mirrors when the native key is set. */
export function shouldSkipCsintSnusbase(): boolean {
  return hasSnusbaseDirect();
}

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
 * True when BreachHub is the live primary — specialty routes and Breaches use
 * sequential BH→CSINT fallback (CSINT only after BH empty/thin / miss).
 * Direct BreachVIP remains additive on Breaches (merge + dedupe).
 */
export function isBreachHubPrimaryActive(): boolean {
  return isBreachHubKeyConfigured();
}

/**
 * Defer CSINT until after BreachHub settles (specialty + Breaches additive).
 * When BH is primary and CSINT is configured, callers should not fire CSINT
 * in parallel with BH.
 */
export function shouldDeferCsintAdditive(): boolean {
  return isBreachHubPrimaryActive() && isCsintEnabled();
}

/** Direct OsintCat — only when BH is off (else BH primary, direct = fallback). */
export function shouldUseDirectOsintCatInParallel(): boolean {
  return hasOsintCatDirect() && !isBreachHubPrimaryActive();
}

/**
 * Direct breach.vip for specialty / combined modules — only when BH is off
 * (BH already mirrors breachvip). Breaches route uses
 * {@link shouldUseAdditiveBreachVip} instead.
 */
export function shouldUseDirectBreachVip(): boolean {
  return isBreachVipEnabled() && !isBreachHubPrimaryActive();
}

/** Breaches searches: always call direct BreachVIP when enabled (merge + dedupe). */
export function shouldUseAdditiveBreachVip(): boolean {
  return isBreachVipEnabled();
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
 * IntelBase intra-BH mirrors always; SeekNow catalog when SEEKNOW_API_KEY is set;
 * Room101 when ROOM101_API_KEY is set.
 * OathNet `/api/oathnet/*` ids are never skipped (BH is primary; CSINT is fallback).
 */
export function getSkippedBreachHubEndpointIds(): Set<string> {
  const skipped = new Set<string>(SKIP_INTELBASE_MIRRORS);

  if (hasDirectSeekNowKeyEnv()) {
    for (const id of SKIP_SEEKNOW_WHEN_DIRECT) skipped.add(id);
  }

  if (hasDirectRoom101KeyEnv()) {
    for (const id of SKIP_ROOM101_WHEN_DIRECT) skipped.add(id);
  }

  return skipped;
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
