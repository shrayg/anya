import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  buildModuleHealthLevels,
  buildModuleHealthMap,
  probeProvidersDetailed,
  uniqueHealthProviderIds,
  type ProviderHealth,
  type ProviderProbeResult,
} from "@/lib/module-health";
import { writePersistedProviderHealth } from "@/lib/provider-health-store";
import { getSkippedBreachHubEndpointIds } from "@/lib/provider-dedupe";

type CachedProviderHealth = {
  expiresAt: number;
  checkedAt: string;
  providers: ProviderProbeResult[];
  map: ProviderHealth;
  modules: Record<string, boolean>;
  levels: Record<string, string>;
  skippedBreachHubIds: string[];
};

let cache: CachedProviderHealth | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  const session = await requireAuthenticatedSession();

  if (session instanceof NextResponse) return session;

  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return NextResponse.json({
      cached: true,
      checkedAt: cache.checkedAt,
      providers: cache.providers,
      modules: cache.modules,
      levels: cache.levels,
      skippedBreachHubIds: cache.skippedBreachHubIds,
    });
  }

  const detailed = await probeProvidersDetailed();
  const uniqueIds = new Set(uniqueHealthProviderIds(detailed));
  // Health strip: configured unique gateways only (no double-count of mirrored vendors).
  const providers = detailed.filter(
    (row) => row.id === "builtin" || uniqueIds.has(row.id),
  );
  const map = {} as ProviderHealth;

  for (const row of detailed) {
    map[row.id] = row.ok;
  }

  const modules = buildModuleHealthMap(map);
  const levels = buildModuleHealthLevels(map);
  const skippedBreachHubIds = [...getSkippedBreachHubEndpointIds()].sort();
  const persisted = writePersistedProviderHealth(map, levels);

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    checkedAt: persisted.checkedAt,
    providers,
    map,
    modules,
    levels,
    skippedBreachHubIds,
  };

  return NextResponse.json({
    cached: false,
    checkedAt: cache.checkedAt,
    providers: cache.providers,
    modules: cache.modules,
    levels: cache.levels,
    skippedBreachHubIds: cache.skippedBreachHubIds,
  });
}
