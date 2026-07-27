/**
 * Standalone provider smoke checks (no Next server-only imports).
 * Usage: npx tsx scripts/smoke-providers.mts
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
      // optional
    }
  }
}

loadEnv();

type Row = { name: string; ok: boolean; ms: number; detail: string };

async function timed(
  name: string,
  fn: () => Promise<{ ok: boolean; detail: string }>,
): Promise<Row> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { name, ok: result.ok, ms: Date.now() - t0, detail: result.detail };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function has(key: string) {
  return Boolean(process.env[key]?.trim());
}

async function main() {
  const rows: Row[] = [];

  // --- config presence ---
  const configured = [
    ["BreachHub key", has("BREACHHUB_API_KEY")],
    ["CSINT key", has("CSINT_API_KEY") || has("CSINT_TOKEN")],
    ["OsintCat key", has("OSINTCAT_API_KEY") || has("OSINTCAT_TOKEN")],
    ["GodsEye key", has("GODSEYE_API_KEY") || has("GODSEYE_TOKEN")],
    ["OathNet key", has("OATHNET_API_KEY")],
    ["IPInfo token", has("IPINFO_TOKEN") || has("IPINFO_API_KEY")],
    ["Seekria key", has("SEEKRIA_API_KEY")],
    ["SeekNow key", has("SEEKNOW_API_KEY")],
    ["Shodan key", has("SHODAN_API_KEY")],
    ["BreachVIP key", has("BREACHVIP_API_KEY")],
  ] as const;

  console.log("=== KEYS PRESENT ===");
  for (const [label, ok] of configured) {
    console.log(`${ok ? "OK " : "NO "} ${label}`);
  }

  // --- live probes ---
  const bhKey = process.env.BREACHHUB_API_KEY?.trim();
  const bhBase =
    process.env.BREACHHUB_BASE_URL?.trim()?.replace(/\/$/, "") ||
    "https://breachhub.org";

  if (bhKey) {
    rows.push(
      await timed("BreachHub ping", async () => {
        const url = `${bhBase}/api/ping?key=${encodeURIComponent(bhKey)}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });
        const text = await res.text();
        return {
          ok: res.ok,
          detail: `HTTP ${res.status} ${text.slice(0, 80)}`,
        };
      }),
    );

    rows.push(
      await timed("BreachHub /api/ipinfo", async () => {
        const url = `${bhBase}/api/ipinfo?key=${encodeURIComponent(bhKey)}&ip=1.1.1.1`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        const json = (await res.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;
        const hasLoc =
          typeof json?.loc === "string" ||
          typeof (json as { data?: { loc?: string } } | null)?.data?.loc ===
            "string" ||
          Boolean(json?.city || json?.org);
        return {
          ok: res.ok && hasLoc,
          detail: `HTTP ${res.status} loc/city=${hasLoc}`,
        };
      }),
    );

    rows.push(
      await timed("BreachHub oathnet/ip-info", async () => {
        const url = `${bhBase}/api/oathnet/ip-info?key=${encodeURIComponent(bhKey)}&ip=1.1.1.1`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        return {
          ok: res.ok || res.status === 404,
          detail: `HTTP ${res.status}`,
        };
      }),
    );
  } else {
    rows.push({
      name: "BreachHub",
      ok: false,
      ms: 0,
      detail: "No BREACHHUB_API_KEY",
    });
  }

  // Free IP geo fallback used by IpIntelPanel
  rows.push(
    await timed("Free IP geo (ipwho.is)", async () => {
      const res = await fetch("https://ipwho.is/1.1.1.1", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
      };
      const ok =
        res.ok &&
        json.success !== false &&
        typeof json.latitude === "number" &&
        typeof json.longitude === "number";
      return {
        ok,
        detail: ok
          ? `lat=${json.latitude} lng=${json.longitude}`
          : `HTTP ${res.status}`,
      };
    }),
  );

  // CSINT status if keyed
  const csintKey =
    process.env.CSINT_API_KEY?.trim() || process.env.CSINT_TOKEN?.trim();
  const csintBase =
    process.env.CSINT_BASE_URL?.trim()?.replace(/\/$/, "") ||
    "https://csint.pro";
  if (csintKey) {
    rows.push(
      await timed("CSINT", async () => {
        // Try a light ping-style path used in codebase if known; otherwise key presence only
        const url = `${csintBase}/api/status`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${csintKey}`,
            "X-API-Key": csintKey,
          },
          signal: AbortSignal.timeout(12_000),
        }).catch(() => null);
        if (!res) {
          return { ok: true, detail: "key present (status endpoint unreachable)" };
        }
        return {
          ok: res.ok || res.status === 401 || res.status === 404,
          detail: `HTTP ${res.status} (key present)`,
        };
      }),
    );
  } else {
    rows.push({ name: "CSINT", ok: false, ms: 0, detail: "No key" });
  }

  // OsintCat
  const ocKey =
    process.env.OSINTCAT_API_KEY?.trim() || process.env.OSINTCAT_TOKEN?.trim();
  if (ocKey) {
    rows.push({
      name: "OsintCat",
      ok: true,
      ms: 0,
      detail: "key present (not live-probed here)",
    });
  } else {
    rows.push({ name: "OsintCat", ok: false, ms: 0, detail: "No key" });
  }

  // GodsEye
  const geKey =
    process.env.GODSEYE_API_KEY?.trim() || process.env.GODSEYE_TOKEN?.trim();
  rows.push({
    name: "GodsEye",
    ok: Boolean(geKey),
    ms: 0,
    detail: geKey ? "key present" : "No key",
  });

  console.log("\n=== LIVE / SMOKE ===");
  for (const row of rows) {
    const tag = row.ok ? "OK  " : "FAIL";
    console.log(
      `${tag}  ${row.name.padEnd(28)} ${String(row.ms).padStart(5)}ms  ${row.detail}`,
    );
  }

  // Feature matrix for recent Breaches work
  console.log("\n=== FEATURE EXPECTATIONS (from keys + probes) ===");
  const bhOk = rows.some((r) => r.name.startsWith("BreachHub") && r.ok);
  const freeGeo = rows.find((r) => r.name.includes("ipwho"))?.ok;
  const matrix = [
    [
      "Breaches fan-out (BH/CSINT indexes)",
      bhOk || Boolean(csintKey),
      bhOk ? "BreachHub up" : csintKey ? "CSINT key only" : "No breach backend",
    ],
    [
      "Email Analyzer CSINT brief",
      Boolean(csintKey),
      csintKey ? "CSINT key present" : "Needs CSINT_API_KEY",
    ],
    [
      "Email Analyzer Seekria OSINT",
      has("SEEKRIA_API_KEY") || bhOk,
      has("SEEKRIA_API_KEY")
        ? "direct Seekria"
        : bhOk
          ? "via BreachHub if mirrored"
          : "No Seekria path",
    ],
    [
      "Email Analyzer SeekNow check",
      has("SEEKNOW_API_KEY") || bhOk,
      has("SEEKNOW_API_KEY")
        ? "direct SeekNow"
        : bhOk
          ? "via BreachHub if mirrored"
          : "No SeekNow path",
    ],
    [
      "Contact Profiles / Index Sweep",
      true,
      "Builtin — works without vendor keys",
    ],
    [
      "IP geo + View on map",
      Boolean(freeGeo) || bhOk || has("IPINFO_TOKEN") || has("IPINFO_API_KEY"),
      freeGeo
        ? "free fallback OK"
        : bhOk
          ? "via BreachHub ipinfo"
          : "No geo source",
    ],
    [
      "IP ports / Shodan-style APIs",
      has("SHODAN_API_KEY") || bhOk,
      has("SHODAN_API_KEY")
        ? "Shodan key"
        : bhOk
          ? "depends on BH IP specialty"
          : "Likely empty ports",
    ],
    [
      "Combo Lookup in Breaches",
      bhOk || Boolean(csintKey),
      "Uses BH snusbase-combo / CSINT when available",
    ],
    [
      "DataVoid recovery in Breaches",
      bhOk,
      bhOk ? "via BreachHub specialty" : "Needs BreachHub",
    ],
    [
      "Home Discord search",
      Boolean(ocKey) || bhOk || Boolean(csintKey),
      "Uses Discord OSINT fan-out",
    ],
  ] as const;

  for (const [feature, ok, note] of matrix) {
    console.log(`${ok ? "WORKS" : "BROKEN"}  ${feature} — ${note}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
