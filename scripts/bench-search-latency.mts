/**
 * End-to-end search latency bench — times each provider peer and BH endpoints.
 *
 * Usage:
 *   npx tsx scripts/bench-search-latency.mts
 *   npx tsx scripts/bench-search-latency.mts --query=test@gmail.com
 *   npx tsx scripts/bench-search-latency.mts --query=john.doe --mode=username
 */

import { readFileSync } from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const i = trimmed.indexOf("=");
        if (i === -1) continue;
        const key = trimmed.slice(0, i).trim();
        let value = trimmed.slice(i + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      /* optional */
    }
  }
}

loadEnv();

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const QUERY = arg("query", "test@gmail.com");
const MODE = arg("mode", "email"); // email | username | phone | discord

type Timed = {
  name: string;
  ms: number;
  ok: boolean;
  detail: string;
};

async function timeIt(
  name: string,
  fn: () => Promise<{ ok: boolean; detail: string }>,
): Promise<Timed> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { name, ms: Date.now() - t0, ok: result.ok, detail: result.detail };
  } catch (err) {
    return {
      name,
      ms: Date.now() - t0,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function printTable(title: string, rows: Timed[]) {
  console.log(`\n=== ${title} ===`);
  const sorted = [...rows].sort((a, b) => b.ms - a.ms);
  for (const row of sorted) {
    const flag = row.ok ? "OK " : "FAIL";
    console.log(
      `${flag}  ${String(row.ms).padStart(6)}ms  ${row.name.padEnd(28)} ${row.detail}`,
    );
  }
  const totalWall = Math.max(...rows.map((r) => r.ms), 0);
  console.log(`(slowest in this set: ${totalWall}ms)`);
}

async function main() {
  const {
    fetchBreachHubAdditiveBreachSearch,
    isBreachHubEnabled,
    isBreachHubCoolingDown,
  } = await import("../lib/breachhub.ts");
  const {
    fetchCsintAdditiveBreachSearch,
    isCsintEnabled,
    isCsintCoolingDown,
  } = await import("../lib/csint.ts");
  const { searchProxynovaCombForEmail } = await import(
    "../lib/proxynova-comb.ts"
  );
  const { fetchGodsEyeEmailReport, fetchGodsEyeSearchResult } = await import(
    "../lib/godseye.ts"
  );
  const { searchBreachVipForEmail } = await import("../lib/breachvip.ts");
  const { fetchOsintCatBreach, getOsintCatApiKey } = await import(
    "../lib/osintcat.ts"
  );
  const { runBreachesOsintSearch } = await import(
    "../lib/breaches-osint-search.ts"
  );
  const { listProviderRequests } = await import(
    "../lib/provider-request-log.ts"
  );
  const { searchContactPresence } = await import(
    "../lib/email-presence/index.ts"
  );
  const { fetchCsintEmailAnalyze } = await import("../lib/csint.ts");
  const { fetchCombinedPlatformSearch } = await import(
    "../lib/osint-combined.ts"
  );
  const { runDiscordOsintSearch } = await import(
    "../lib/discord-osint-search.ts"
  );

  console.log(`Query=${QUERY} mode=${MODE}`);
  console.log(
    `BH enabled=${isBreachHubEnabled()} cooling=${isBreachHubCoolingDown()} | CSINT enabled=${isCsintEnabled()} cooling=${isCsintCoolingDown()}`,
  );

  if (MODE === "email") {
    // --- Isolated peers (sequential so timings are honest) ---
    const isolated: Timed[] = [];

    isolated.push(
      await timeIt("BreachHub additive", async () => {
        const res = await fetchBreachHubAdditiveBreachSearch(
          QUERY,
          "email",
          48_000,
        );
        return {
          ok: Boolean(res),
          detail: res
            ? `rows=${res.results.length} count=${res.count}`
            : "null",
        };
      }),
    );

    const bhEndpointRows = listProviderRequests()
      .filter((e) => e.gateway === "breachhub")
      .sort((a, b) => b.latencyMs - a.latencyMs)
      .slice(0, 25);

    console.log("\n=== BreachHub per-endpoint (from last BH call) ===");
    for (const e of bhEndpointRows) {
      console.log(
        `${e.ok ? "OK " : "FAIL"}  ${String(e.latencyMs).padStart(6)}ms  ${e.path}  status=${e.statusCode ?? "-"} ${e.error ?? ""}`,
      );
    }

    isolated.push(
      await timeIt("ProxyNova COMB", async () => {
        const res = await searchProxynovaCombForEmail(QUERY, {
          start: 0,
          limit: 100,
        });
        return {
          ok: true,
          detail: `rows=${res.credentials.length} total=${res.total}`,
        };
      }),
    );

    isolated.push(
      await timeIt("GodsEye email report", async () => {
        const res = await fetchGodsEyeEmailReport(QUERY);
        return {
          ok: Boolean(res),
          detail: res ? `keys=${Object.keys(res).length}` : "null",
        };
      }),
    );

    isolated.push(
      await timeIt("GodsEye search", async () => {
        const res = await fetchGodsEyeSearchResult("email", QUERY, 18_000);
        return {
          ok: Boolean(res?.results?.length),
          detail: res
            ? `rows=${res.results.length} count=${res.count}`
            : "null",
        };
      }),
    );

    isolated.push(
      await timeIt("BreachVIP email", async () => {
        const res = await searchBreachVipForEmail(QUERY, { maxRows: 500 });
        return {
          ok: Boolean(res),
          detail: res
            ? `rows=${res.credentials.length}`
            : "null/skipped",
        };
      }),
    );

    isolated.push(
      await timeIt("CSINT additive", async () => {
        if (!isCsintEnabled() || isCsintCoolingDown()) {
          return { ok: false, detail: "disabled/cooling" };
        }
        const res = await fetchCsintAdditiveBreachSearch(
          QUERY,
          "email",
          28_000,
        );
        return {
          ok: Boolean(res),
          detail: res
            ? `rows=${res.results.length} count=${res.count}`
            : "null",
        };
      }),
    );

    if (getOsintCatApiKey()) {
      isolated.push(
        await timeIt("OsintCat breach", async () => {
          const res = await fetchOsintCatBreach(QUERY, "email");
          return {
            ok: Boolean(res),
            detail: res ? `count=${res.count}` : "null",
          };
        }),
      );
    }

    printTable("ISOLATED PROVIDERS (email)", isolated);

    // --- Full orchestrator (homepage-equivalent) ---
    const progress: { module: string; atMs: number }[] = [];
    const orchT0 = Date.now();
    const orch = await runBreachesOsintSearch(
      QUERY,
      { kindHint: "email", limit: 500 },
      (event) => {
        if (event.type === "partial") {
          progress.push({
            module: event.module,
            atMs: Date.now() - orchT0,
          });
          console.log(
            `  partial @${Date.now() - orchT0}ms module=${event.module} done=${event.done}/${event.total} rows=${event.result.credentials.length}`,
          );
        }
      },
    );
    const orchMs = Date.now() - orchT0;
    console.log(`\n=== FULL ORCHESTRATOR (homepage breaches) ===`);
    console.log(`WALL ${orchMs}ms`);
    console.log(
      `rows=${orch.credentials.length} bh=${orch.breachHubCount} csint=${orch.csintCount} vip=${orch.breachVipCount} cat=${orch.osintCatCount} ge=${orch.godseyeSearchCount} rateLimited=${orch.breachHubRateLimited ?? false}`,
    );
    console.log(
      "partial timeline:",
      progress.map((p) => `${p.module}@${p.atMs}ms`).join(" → ") || "(none)",
    );

    // --- Companions (post-paint on homepage) ---
    const companions: Timed[] = [];
    companions.push(
      await timeIt("email-analyze CSINT", async () => {
        const res = await fetchCsintEmailAnalyze(QUERY);
        return {
          ok: Boolean(res),
          detail: res ? `ok` : "null",
        };
      }),
    );
    companions.push(
      await timeIt("contact-presence", async () => {
        const res = await searchContactPresence({
          query: QUERY,
          deep: false,
        });
        return {
          ok: true,
          detail: `found=${res.found?.length ?? 0} profiles=${res.profileCount ?? 0}`,
        };
      }),
    );
    printTable("COMPANION FETCHES (after main results)", companions);
  }

  if (MODE === "username" || MODE === "phone") {
    const scope = MODE === "phone" ? "phone" : "username";
    const godseyeType = scope === "phone" ? "phone" : "username";
    const breachVipField = scope === "phone" ? "phone" : "username";
    const row = await timeIt(`combined platform (${scope})`, async () => {
      const res = await fetchCombinedPlatformSearch(
        QUERY,
        undefined,
        godseyeType,
        breachVipField as "phone" | "username",
        scope,
      );
      return {
        ok: true,
        detail: `rows=${res.results?.length ?? 0} count=${res.count}`,
      };
    });
    printTable(`PLATFORM SEARCH (${scope})`, [row]);
  }

  if (MODE === "discord") {
    const row = await timeIt("discord osint", async () => {
      const res = await runDiscordOsintSearch(QUERY);
      return {
        ok: true,
        detail: `leaks=${res.leaks?.results?.length ?? 0}`,
      };
    });
    printTable("DISCORD SEARCH", [row]);
  }

  // Dump all provider request logs sorted by latency
  const all = listProviderRequests().sort((a, b) => b.latencyMs - a.latencyMs);
  console.log("\n=== ALL PROVIDER REQUEST LOG (slowest first) ===");
  for (const e of all.slice(0, 40)) {
    console.log(
      `${e.ok ? "OK " : "FAIL"}  ${String(e.latencyMs).padStart(6)}ms  [${e.gateway}] ${e.method} ${e.path} ${e.error ?? ""}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
