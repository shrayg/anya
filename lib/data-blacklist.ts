/**
 * Admin data blacklist — exact normalized match against emails, phones,
 * usernames, domains, IPs, passwords, etc. Server-side only.
 */

import { prisma } from "@/prisma/client";

const CACHE_TTL_MS = 30_000;

/** Identity / secret fields checked when filtering result records. */
const MATCH_FIELD_KEYS = new Set([
  "email",
  "mail",
  "e_mail",
  "mail_address",
  "username",
  "user",
  "login",
  "handle",
  "screen_name",
  "phone",
  "phone_number",
  "mobile",
  "tel",
  "number",
  "domain",
  "site",
  "website",
  "url",
  "ip",
  "ip_address",
  "lastip",
  "last_ip",
  "password",
  "pass",
  "passwd",
  "secret",
  "identifier",
  "raw",
]);

type CacheState = {
  values: ReadonlySet<string>;
  loadedAt: number;
  inflight: Promise<ReadonlySet<string>> | null;
};

const cache: CacheState = {
  values: new Set(),
  loadedAt: 0,
  inflight: null,
};

export function normalizeBlacklistValue(value: string): string {
  return value.trim().toLowerCase();
}

export function getCachedBlacklistSet(): ReadonlySet<string> {
  return cache.values;
}

export function invalidateDataBlacklistCache(): void {
  cache.loadedAt = 0;
  cache.values = new Set();
  cache.inflight = null;
}

async function fetchBlacklistSet(): Promise<ReadonlySet<string>> {
  const rows = await prisma.dataBlacklist.findMany({
    select: { value: true },
  });

  return new Set(rows.map((row) => row.value));
}

/** Load (or refresh) the in-memory blacklist set. Safe to call per-request. */
export async function warmDataBlacklistCache(
  force = false,
): Promise<ReadonlySet<string>> {
  const fresh =
    !force &&
    cache.loadedAt > 0 &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS;

  if (fresh) return cache.values;

  if (cache.inflight) return cache.inflight;

  cache.inflight = fetchBlacklistSet()
    .then((values) => {
      cache.values = values;
      cache.loadedAt = Date.now();
      cache.inflight = null;

      return values;
    })
    .catch((error) => {
      cache.inflight = null;
      console.error("Data blacklist load failed:", error);

      return cache.values;
    });

  return cache.inflight;
}

export function valueIsBlacklisted(
  value: unknown,
  set: ReadonlySet<string> = cache.values,
): boolean {
  if (set.size === 0) return false;

  if (typeof value === "string") {
    const normalized = normalizeBlacklistValue(value);

    return Boolean(normalized) && set.has(normalized);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return set.has(String(value));
  }

  return false;
}

function collectMatchCandidates(record: Record<string, unknown>): string[] {
  const out: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();

    if (!MATCH_FIELD_KEYS.has(lower) && !MATCH_FIELD_KEYS.has(key)) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" || typeof item === "number") {
          out.push(String(item));
        }
      }
    }
  }

  return out;
}

/** True when any identity/secret field on the record matches the blacklist. */
export function recordMatchesBlacklist(
  entry: unknown,
  set: ReadonlySet<string> = cache.values,
): boolean {
  if (set.size === 0) return false;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;

  const record = entry as Record<string, unknown>;

  for (const candidate of collectMatchCandidates(record)) {
    if (valueIsBlacklisted(candidate, set)) return true;
  }

  // Nested credential rows (stealer archives, etc.).
  if (Array.isArray(record.credentials)) {
    for (const cred of record.credentials) {
      if (recordMatchesBlacklist(cred, set)) return true;
    }
  }

  if (Array.isArray(record.fields)) {
    for (const field of record.fields) {
      if (!field || typeof field !== "object") continue;
      const row = field as Record<string, unknown>;
      const key =
        typeof row.key === "string" ? row.key.toLowerCase() : "";
      if (
        (MATCH_FIELD_KEYS.has(key) || !key) &&
        valueIsBlacklisted(row.value, set)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function filterBlacklistedRecords<T>(
  results: T[],
  set: ReadonlySet<string> = cache.values,
): T[] {
  if (set.size === 0 || results.length === 0) return results;

  return results.filter((entry) => !recordMatchesBlacklist(entry, set));
}

type CredentialLike = {
  identifier?: string;
  secret?: string;
  raw?: string;
  username?: string;
  password?: string;
  site?: string;
  fields?: Array<{ key?: string; value?: string }>;
};

/** Drop comb / stealer credential rows that contain a blacklisted value. */
export function filterBlacklistedCredentials<T extends CredentialLike>(
  credentials: T[],
  set: ReadonlySet<string> = cache.values,
): T[] {
  if (set.size === 0 || credentials.length === 0) return credentials;

  return credentials.filter((row) => {
    if (valueIsBlacklisted(row.identifier, set)) return false;
    if (valueIsBlacklisted(row.secret, set)) return false;
    if (valueIsBlacklisted(row.raw, set)) return false;
    if (valueIsBlacklisted(row.username, set)) return false;
    if (valueIsBlacklisted(row.password, set)) return false;
    if (valueIsBlacklisted(row.site, set)) return false;

    if (Array.isArray(row.fields)) {
      for (const field of row.fields) {
        if (valueIsBlacklisted(field?.value, set)) return false;
      }
    }

    return true;
  });
}

const ARRAY_KEYS = new Set([
  "credentials",
  "results",
  "records",
  "rows",
  "data",
  "hits",
  "items",
  "entries",
  "archives",
]);

const COUNT_KEYS = [
  "totalMatches",
  "returned",
  "count",
  "total",
  "breachVipCount",
  "csintCount",
  "breachHubCount",
  "osintCatCount",
  "godseyeSearchCount",
] as const;

/**
 * Walk a typical OSINT JSON payload and strip blacklisted credential / result
 * rows. Updates common count fields when their backing array shrank.
 */
export function applyDataBlacklistToPayload(
  data: unknown,
  set: ReadonlySet<string> = cache.values,
): unknown {
  if (set.size === 0) return data;
  if (data == null) return data;

  if (Array.isArray(data)) {
    return filterBlacklistedRecords(data, set);
  }

  if (typeof data !== "object") return data;

  const source = data as Record<string, unknown>;
  const out: Record<string, unknown> = { ...source };
  let mutated = false;

  for (const key of ARRAY_KEYS) {
    const value = source[key];

    if (!Array.isArray(value) || value.length === 0) continue;

    const filtered =
      key === "credentials"
        ? filterBlacklistedCredentials(value as CredentialLike[], set)
        : filterBlacklistedRecords(value, set);

    if (filtered.length !== value.length) {
      out[key] = filtered;
      mutated = true;
    }
  }

  // Nested archives may hold credential arrays.
  if (Array.isArray(out.archives)) {
    const archives = (out.archives as unknown[]).map((archive) => {
      if (!archive || typeof archive !== "object") return archive;
      const row = archive as Record<string, unknown>;

      if (!Array.isArray(row.credentials)) return archive;

      const creds = filterBlacklistedCredentials(
        row.credentials as CredentialLike[],
        set,
      );

      if (creds.length === row.credentials.length) return archive;

      mutated = true;

      return { ...row, credentials: creds };
    });

    out.archives = archives;
  }

  if (!mutated) return data;

  // Keep count fields honest when credentials/results shrank.
  if (Array.isArray(out.credentials)) {
    const n = out.credentials.length;

    if (typeof out.totalMatches === "number") out.totalMatches = n;
    if (typeof out.returned === "number") out.returned = n;
  }

  if (Array.isArray(out.results)) {
    const n = out.results.length;

    if (typeof out.count === "number") out.count = n;
  }

  for (const key of COUNT_KEYS) {
    // Provider-specific counts stay as diagnostic metadata; only sync
    // when we clearly own the backing array above.
    void key;
  }

  return out;
}
