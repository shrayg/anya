import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  buildModuleHealthLevels,
  buildModuleHealthMap,
  probeProvidersDetailed,
  type ProviderHealth,
  type ProviderProbeResult,
} from "@/lib/module-health";
import { writePersistedProviderHealth } from "@/lib/provider-health-store";

type CachedProviderHealth = {
  expiresAt: number;
  checkedAt: string;
  providers: ProviderProbeResult[];
  map: ProviderHealth;
  modules: Record<string, boolean>;
  levels: Record<string, string>;
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
    });
  }

  const providers = await probeProvidersDetailed();
  const map = {} as ProviderHealth;

  for (const row of providers) {
    map[row.id] = row.ok;
  }

  const modules = buildModuleHealthMap(map);
  const levels = buildModuleHealthLevels(map);
  const persisted = writePersistedProviderHealth(map, levels);

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    checkedAt: persisted.checkedAt,
    providers,
    map,
    modules,
    levels,
  };

  return NextResponse.json({
    cached: false,
    checkedAt: cache.checkedAt,
    providers: cache.providers,
    modules: cache.modules,
    levels: cache.levels,
  });
}
