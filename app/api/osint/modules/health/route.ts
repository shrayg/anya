import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  buildModuleHealthLevels,
  buildModuleHealthMap,
  probeProviders,
  type ModuleHealthLevel,
  type ProviderHealth,
} from "@/lib/module-health";
import {
  readPersistedProviderHealth,
  writePersistedProviderHealth,
} from "@/lib/provider-health-store";

type CachedHealth = {
  expiresAt: number;
  checkedAt: string;
  providers: ProviderHealth;
  modules: Record<string, boolean>;
  levels: Record<string, ModuleHealthLevel>;
};

let cache: CachedHealth | null = null;
const CACHE_TTL_MS = 60_000;
/** Serve persisted snapshot up to this age when a live probe is in flight / skipped. */
const PERSIST_MAX_AGE_MS = 5 * 60_000;

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

  const providers = await probeProviders();
  const modules = buildModuleHealthMap(providers);
  const levels = buildModuleHealthLevels(providers);
  const persisted = writePersistedProviderHealth(providers, levels);

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    checkedAt: persisted.checkedAt,
    providers,
    modules,
    levels,
  };

  return NextResponse.json({
    cached: false,
    checkedAt: persisted.checkedAt,
    providers: cache.providers,
    modules: cache.modules,
    levels: cache.levels,
  });
}

/** Optional: return last persisted snapshot without re-probing (cron-friendly). */
export async function HEAD() {
  const session = await requireAuthenticatedSession();

  if (session instanceof NextResponse) return session;

  const persisted = readPersistedProviderHealth();

  if (!persisted) {
    return new NextResponse(null, { status: 204 });
  }

  const age = Date.now() - Date.parse(persisted.checkedAt);

  return new NextResponse(null, {
    status: Number.isFinite(age) && age <= PERSIST_MAX_AGE_MS ? 200 : 204,
    headers: {
      "X-Health-Checked-At": persisted.checkedAt,
    },
  });
}
