import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import "server-only";

import type {
  ModuleHealthLevel,
  ProviderHealth,
  ProviderId,
} from "@/lib/module-health";

export type PersistedProviderHealth = {
  checkedAt: string;
  providers: Record<ProviderId, boolean>;
  modules: Record<string, ModuleHealthLevel>;
};

const STORE_PATH = join(process.cwd(), "data", "provider-health.json");

export function readPersistedProviderHealth(): PersistedProviderHealth | null {
  try {
    if (!existsSync(STORE_PATH)) return null;
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PersistedProviderHealth;

    if (!parsed?.checkedAt || !parsed.providers || !parsed.modules) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedProviderHealth(
  providers: ProviderHealth,
  modules: Record<string, ModuleHealthLevel>,
): PersistedProviderHealth {
  const payload: PersistedProviderHealth = {
    checkedAt: new Date().toISOString(),
    providers,
    modules,
  };

  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch {
    // Disk may be read-only in some hosts — in-memory cache still works.
  }

  return payload;
}
