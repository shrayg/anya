/**
 * Cross-gateway vendor dedupe for OSINT fan-out.
 *
 * Prefer a configured direct client over the same vendor via BreachHub proxy.
 * BreachHub endpoints that are unique (no direct client) stay in the fan-out.
 *
 * Overlap table (vendor → primary → skipped BreachHub ids):
 * | Vendor              | Primary                         | Skipped when primary configured      |
 * |---------------------|---------------------------------|--------------------------------------|
 * | OsintCat DB/breach  | OSINTCAT_API_KEY (lib/osintcat) | osintcat-database, discord-stalker   |
 * | OsintCat twitter/MV | BreachHub (no direct client)    | (none — keep unique BH paths)        |
 * | Breach.vip          | breach.vip (lib/breachvip)      | breachvip, intelbase-breachvip       |
 * | Snusbase            | CSINT /snusbase/*               | snusbase, snusbase-combo, snusbase-hash |
 * | BreachBase          | CSINT /breachbase               | breachbase                           |
 * | Shodan host         | CSINT /shodan/host              | shodan-host                          |
 * | Melissa             | CSINT /melissa/lookup           | melissa                              |
 * | SEON email/phone    | CSINT /seon/*                   | seon-email, seon-phone               |
 * | CordCat             | CORDCAT_API_KEY (lib/cordcat)   | cordcat, cordcat-ip                  |
 * | OathNet Discord→RBX | CSINT /oathnet/discord-to-roblox| oathnet-discord-roblox               |
 * | IntelX export       | CSINT storage / BH system UUID  | (export routes pick one path; not additive) |
 * | IntelBase mirrors   | direct BH vendor endpoints      | always skip listed intelbase-* mirrors     |
 *
 * Kept via BreachHub even when CSINT/OsintCat are on: snusbase-ip-whois,
 * shodan-dns*, shodan-search, seon-ip/bin, osintcat-machine-*, osintcat-twitter,
 * seeknow-discord-roblox, and every other catalog id not listed below.
 */

import { isBreachVipEnabled } from "@/lib/breachvip";
import { isCordCatConfigured } from "@/lib/cordcat";
import { isCsintEnabled } from "@/lib/csint";
import { getOsintCatApiKey } from "@/lib/osintcat";

/** BreachHub endpoint ids that mirror a configured direct vendor. */
const SKIP_WHEN_OSINTCAT = [
  "osintcat-database",
  "discord-stalker",
] as const;

const SKIP_WHEN_BREACHVIP = [
  "breachvip",
  "intelbase-breachvip",
] as const;

const SKIP_WHEN_CSINT = [
  "snusbase",
  "snusbase-combo",
  "snusbase-hash",
  "breachbase",
  "shodan-host",
  "melissa",
  "seon-email",
  "seon-phone",
  "oathnet-discord-roblox",
] as const;

const SKIP_WHEN_CORDCAT = ["cordcat", "cordcat-ip"] as const;

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
  | "osintcat"
  | "breachvip"
  | "csint"
  | "cordcat";

export type ProviderOverlapRow = {
  vendor: string;
  primary: string;
  skippedBreachHubIds: readonly string[];
};

/** Static overlap map for docs / status tooling. */
export const PROVIDER_OVERLAP_TABLE: ProviderOverlapRow[] = [
  {
    vendor: "OsintCat (database / stalker)",
    primary: "direct OSINTCAT_API_KEY",
    skippedBreachHubIds: SKIP_WHEN_OSINTCAT,
  },
  {
    vendor: "Breach.vip",
    primary: "direct breach.vip (lib/breachvip)",
    skippedBreachHubIds: SKIP_WHEN_BREACHVIP,
  },
  {
    vendor: "Snusbase / BreachBase / Shodan host / Melissa / SEON email·phone / OathNet D→R",
    primary: "CSINT_API_KEY (lib/csint)",
    skippedBreachHubIds: SKIP_WHEN_CSINT,
  },
  {
    vendor: "CordCat",
    primary: "CORDCAT_API_KEY (lib/cordcat)",
    skippedBreachHubIds: SKIP_WHEN_CORDCAT,
  },
  {
    vendor: "IntelBase mirrors",
    primary: "direct BreachHub vendor endpoints (always)",
    skippedBreachHubIds: SKIP_INTELBASE_MIRRORS,
  },
  {
    vendor: "IntelX export",
    primary: "CSINT storageid; BreachHub system_id (UUID); GodsEye fallback",
    skippedBreachHubIds: [],
  },
];

function hasOsintCatDirect(): boolean {
  return Boolean(getOsintCatApiKey()?.trim());
}

/**
 * BreachHub endpoint ids to skip for the current env (configured primaries).
 * Empty when no overlapping direct clients are configured.
 */
export function getSkippedBreachHubEndpointIds(): Set<string> {
  const skipped = new Set<string>(SKIP_INTELBASE_MIRRORS);

  if (hasOsintCatDirect()) {
    for (const id of SKIP_WHEN_OSINTCAT) skipped.add(id);
  }

  if (isBreachVipEnabled()) {
    for (const id of SKIP_WHEN_BREACHVIP) skipped.add(id);
  }

  if (isCsintEnabled()) {
    for (const id of SKIP_WHEN_CSINT) skipped.add(id);
  }

  if (isCordCatConfigured()) {
    for (const id of SKIP_WHEN_CORDCAT) skipped.add(id);
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

  if (skipped.size === 0) return endpoints;

  return endpoints.filter((endpoint) => !skipped.has(endpoint.id));
}

export function filterBreachHubEndpointIds(ids: string[]): string[] {
  const skipped = getSkippedBreachHubEndpointIds();

  if (skipped.size === 0) return ids;

  return ids.filter((id) => !skipped.has(id));
}

/** Which direct primaries are active (for health / diagnostics). */
export function activeProviderPrimaries(): ProviderDedupePrimary[] {
  const out: ProviderDedupePrimary[] = [];

  if (hasOsintCatDirect()) out.push("osintcat");
  if (isBreachVipEnabled()) out.push("breachvip");
  if (isCsintEnabled()) out.push("csint");
  if (isCordCatConfigured()) out.push("cordcat");

  return out;
}
