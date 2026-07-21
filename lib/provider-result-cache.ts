/**
 * Process-local short-TTL cache for identical upstream OSINT calls.
 * Not shared across instances; never persist. Keys must omit secrets.
 */

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const MAX_ENTRIES = 256;
const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function pruneExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function evictOldestIfNeeded(): void {
  if (store.size < MAX_ENTRIES) return;

  const first = store.keys().next().value;

  if (first !== undefined) store.delete(first);
}

export function providerCacheKey(
  provider: string,
  parts: Record<string, string> | string[],
): string {
  if (Array.isArray(parts)) {
    return `${provider}|${parts.map((p) => p.trim().toLowerCase()).join("|")}`;
  }

  const sorted = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ""}`)
    .join("&");

  return `${provider}|${sorted}`;
}

export function getProviderCached<T>(key: string): T | null {
  const hit = store.get(key);

  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);

    return null;
  }

  return hit.value as T;
}

export function setProviderCached<T>(
  key: string,
  value: T,
  ttlMs: number,
): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;

  const now = Date.now();

  pruneExpired(now);
  evictOldestIfNeeded();
  store.set(key, { value, expiresAt: now + ttlMs });
}

/**
 * Coalesce concurrent identical work and memoize the result briefly.
 * Failures are not cached so callers can retry.
 */
export async function withProviderCache<T>(
  key: string,
  ttlMs: number,
  work: () => Promise<T>,
): Promise<T> {
  const cached = getProviderCached<T>(key);

  if (cached !== null) return cached;

  const pending = inflight.get(key) as Promise<T> | undefined;

  if (pending) return pending;

  const run = (async () => {
    try {
      const value = await work();

      setProviderCached(key, value, ttlMs);

      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);

  return run;
}
