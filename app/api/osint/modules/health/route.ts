import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  buildModuleHealthMap,
  probeProviders,
  type ProviderHealth,
} from "@/lib/module-health";

type CachedHealth = {
  expiresAt: number;
  providers: ProviderHealth;
  modules: Record<string, boolean>;
};

let cache: CachedHealth | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  const session = await requireAuthenticatedSession();
  if (session instanceof NextResponse) return session;

  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return NextResponse.json({
      cached: true,
      providers: cache.providers,
      modules: cache.modules,
    });
  }

  const providers = await probeProviders();
  const modules = buildModuleHealthMap(providers);

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    providers,
    modules,
  };

  return NextResponse.json({
    cached: false,
    providers,
    modules,
  });
}
