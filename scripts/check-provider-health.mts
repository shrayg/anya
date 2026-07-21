/**
 * Probe OSINT provider health (BreachHub ping, GodsEye, CSINT, OsintCat, …)
 * and persist last status under data/provider-health.json.
 *
 * Usage:
 *   npx tsx scripts/check-provider-health.mts
 *   npm run health:providers
 *
 * Safe for cron every few minutes — uses cheap ping/status endpoints only.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(file, "utf8");

      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) continue;

        const index = trimmed.indexOf("=");

        if (index === -1) continue;

        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // optional
    }
  }
}

loadEnv();

const {
  buildModuleHealthLevels,
  buildModuleHealthMap,
  probeProvidersDetailed,
  type ProviderHealth,
} = await import("../lib/module-health.ts");

const STORE_PATH = join(process.cwd(), "data", "provider-health.json");

async function main() {
  const started = Date.now();
  const detailed = await probeProvidersDetailed();
  const providers = {} as ProviderHealth;

  for (const row of detailed) {
    providers[row.id] = row.ok;
  }

  const modules = buildModuleHealthMap(providers);
  const levels = buildModuleHealthLevels(providers);
  const checkedAt = new Date().toISOString();

  const payload = {
    checkedAt,
    providers: detailed,
    modules: levels,
    booleanModules: modules,
    elapsedMs: Date.now() - started,
  };

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const providerLines = detailed
    .map((row) => {
      const status = row.unprobed ? "SKIP" : row.ok ? "OK  " : "DOWN";

      return `  ${status}  ${row.label.padEnd(18)} ${row.latencyMs}ms${row.error ? ` — ${row.error}` : ""}`;
    })
    .join("\n");

  const downModules = Object.entries(levels)
    .filter(([, level]) => level === "down")
    .map(([slug]) => slug);
  const degradedModules = Object.entries(levels)
    .filter(([, level]) => level === "degraded")
    .map(([slug]) => slug);

  console.log(`Provider health @ ${checkedAt} (${payload.elapsedMs}ms)`);
  console.log(providerLines);
  if (degradedModules.length) {
    console.log(`Degraded modules: ${degradedModules.join(", ")}`);
  }
  if (downModules.length) {
    console.log(`Down modules: ${downModules.join(", ")}`);
  } else {
    console.log("No modules fully down.");
  }
  console.log(`Wrote ${STORE_PATH}`);

  const anyDown = detailed.some((row) => !row.ok && !row.unprobed);

  process.exitCode = anyDown ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
