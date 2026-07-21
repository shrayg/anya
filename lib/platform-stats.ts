/**
 * Public platform scale metrics for marketing ("By the Numbers").
 * Prefer live provider analytics when keys/network allow; always include
 * catalog-computed module / username-site counts and status uptime.
 */

import "server-only";

import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import { getCsintApiKey, isCsintEnabled } from "@/lib/csint";
import { getUsernameAccountSites } from "@/lib/username-accounts/sites";
import { readStatusHistory } from "@/lib/status-history";

export type PlatformStatItem = {
  key: string;
  label: string;
  value: string;
  raw: number | null;
  source: "computed" | "provider" | "status" | "env";
};

export type PlatformStatsPayload = {
  checkedAt: string;
  cached: boolean;
  stats: PlatformStatItem[];
};

type CachedStats = {
  expiresAt: number;
  payload: PlatformStatsPayload;
};

let cache: CachedStats | null = null;
const CACHE_TTL_MS = 15 * 60_000;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function digNumber(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    let cur: unknown = root;
    let ok = true;
    for (const key of path) {
      if (!cur || typeof cur !== "object") {
        ok = false;
        break;
      }
      cur = (cur as Record<string, unknown>)[key];
    }
    if (!ok) continue;
    const n = asNumber(cur);
    if (n != null) return n;
  }
  return null;
}

/** Compact display: 4.2B+, 780.0M, 47, 99.9% */
export function formatCompactStat(
  value: number,
  options?: { percent?: boolean; plus?: boolean },
): string {
  if (options?.percent) {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toFixed(1)}%`;
  }

  const plus = options?.plus === false ? "" : value >= 1_000_000 ? "+" : "";

  if (value >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}B${plus}`;
  }
  if (value >= 1_000_000) {
    const n = value / 1_000_000;
    return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)}M${plus}`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}K${plus}`;
  }
  return Math.round(value).toLocaleString("en-US");
}

async function fetchOathnetIndexedRecords(): Promise<number | null> {
  const urls = [
    "https://oathnet.org/api/service/v2/analytics/stats",
    "https://oathnet.org/service/v2/analytics/stats",
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "AnyaInt-PlatformStats/1.0",
        },
        timeoutMs: 12_000,
      });
      if (!res.ok) continue;
      const text = await readResponseText(res);
      const json = JSON.parse(text) as unknown;
      const n = digNumber(json, [
        ["data", "summary", "indexed_records"],
        ["data", "indexed_records"],
        ["summary", "indexed_records"],
        ["indexed_records"],
      ]);
      if (n != null && n > 0) return n;
    } catch {
      // try next
    }
  }

  return null;
}

async function fetchCsintIndexedRecords(): Promise<{
  records: number | null;
  victims: number | null;
}> {
  if (!isCsintEnabled()) return { records: null, victims: null };
  const key = getCsintApiKey();
  if (!key) return { records: null, victims: null };

  const endpoints = [
    "https://csint.pro/api/stats",
    "https://csint.pro/api/analytics/stats",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": key,
          Authorization: `Bearer ${key}`,
        },
        body: "{}",
        timeoutMs: 14_000,
      });
      if (!res.ok) continue;
      const text = await readResponseText(res);
      const json = JSON.parse(text) as unknown;
      const records = digNumber(json, [
        ["data", "summary", "indexed_records"],
        ["data", "indexed_records"],
        ["summary", "indexed_records"],
        ["indexed_records"],
        ["total_records"],
        ["records"],
        ["data", "records"],
        ["data", "total"],
      ]);
      const victims = digNumber(json, [
        ["data", "summary", "stealer_victims"],
        ["data", "stealer_victims"],
        ["stealer_victims"],
        ["victims"],
        ["data", "victims"],
        ["data", "summary", "victims"],
      ]);
      if (records != null || victims != null) {
        return { records, victims };
      }
    } catch {
      // try next
    }
  }

  return { records: null, victims: null };
}

function envIndexedRecords(): number | null {
  const raw = process.env.PLATFORM_INDEXED_RECORDS?.trim();
  if (!raw) return null;
  return asNumber(raw);
}

export async function getPlatformStats(options?: {
  bypassCache?: boolean;
}): Promise<PlatformStatsPayload> {
  const now = Date.now();
  if (!options?.bypassCache && cache && cache.expiresAt > now) {
    return { ...cache.payload, cached: true };
  }

  const modules = CATALOG_MODULE_COUNT;
  const usernameSites = getUsernameAccountSites().length;
  const history = readStatusHistory();
  const uptime = history.overall.uptimePercent;

  const [oathnetRecords, csint] = await Promise.all([
    fetchOathnetIndexedRecords(),
    fetchCsintIndexedRecords(),
  ]);

  const envRecords = envIndexedRecords();
  const indexedRecords = oathnetRecords ?? csint.records ?? envRecords;
  const indexedSource: PlatformStatItem["source"] = oathnetRecords
    ? "provider"
    : csint.records
      ? "provider"
      : envRecords
        ? "env"
        : "computed";

  const stats: PlatformStatItem[] = [];

  if (indexedRecords != null && indexedRecords > 0) {
    stats.push({
      key: "records",
      label: "Records Indexed",
      value: formatCompactStat(indexedRecords),
      raw: indexedRecords,
      source: indexedSource,
    });
  } else {
    // Honest fallback: measurable coverage across username index + catalog.
    stats.push({
      key: "coverage",
      label: "Lookup Surfaces",
      value: formatCompactStat(modules + usernameSites, { plus: false }),
      raw: modules + usernameSites,
      source: "computed",
    });
  }

  if (csint.victims != null && csint.victims > 0) {
    stats.push({
      key: "victims",
      label: "Stealer-log Victims",
      value: formatCompactStat(csint.victims),
      raw: csint.victims,
      source: "provider",
    });
  } else {
    stats.push({
      key: "platforms",
      label: "Username Platforms",
      value: formatCompactStat(usernameSites, { plus: false }),
      raw: usernameSites,
      source: "computed",
    });
  }

  stats.push({
    key: "modules",
    label: "Intelligence Modules",
    value: formatCompactStat(modules, { plus: false }),
    raw: modules,
    source: "computed",
  });

  stats.push({
    key: "uptime",
    label: "Platform Uptime",
    value: formatCompactStat(uptime, { percent: true }),
    raw: uptime,
    source: "status",
  });

  const payload: PlatformStatsPayload = {
    checkedAt: new Date().toISOString(),
    cached: false,
    stats: stats.slice(0, 4),
  };

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  };

  return payload;
}
