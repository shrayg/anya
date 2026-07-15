import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export const US_RECORDS_UA =
  "Anya.Int/1.0 (+https://anyaint.com; public-records research; contact support@anyaint.com)";

export const SOURCE_LIMITS = {
  courtlistener: { timeoutMs: 12_000, ttlMs: 6 * 60 * 60 * 1000 },
  openfec: { timeoutMs: 10_000, ttlMs: 6 * 60 * 60 * 1000 },
  nppes: { timeoutMs: 10_000, ttlMs: 6 * 60 * 60 * 1000 },
  ofac: { timeoutMs: 30_000, ttlMs: 24 * 60 * 60 * 1000 },
} as const;

const lastCallAt = new Map<string, number>();

export async function paceSource(source: string, minIntervalMs: number): Promise<void> {
  const previous = lastCallAt.get(source) ?? 0;
  const wait = minIntervalMs - (Date.now() - previous);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCallAt.set(source, Date.now());
}

export async function fetchUsRecordsJson<T>(
  url: string,
  options: {
    source: keyof typeof SOURCE_LIMITS;
    headers?: Record<string, string>;
    minIntervalMs?: number;
  },
): Promise<T> {
  const limits = SOURCE_LIMITS[options.source];
  await paceSource(options.source, options.minIntervalMs ?? 250);

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: limits.timeoutMs,
    headers: {
      Accept: "application/json",
      "User-Agent": US_RECORDS_UA,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`${options.source} HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function fetchUsRecordsText(
  url: string,
  options: {
    source: keyof typeof SOURCE_LIMITS;
    headers?: Record<string, string>;
    minIntervalMs?: number;
  },
): Promise<string> {
  const limits = SOURCE_LIMITS[options.source];
  await paceSource(options.source, options.minIntervalMs ?? 250);

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: limits.timeoutMs,
    headers: {
      Accept: "text/csv,text/plain,*/*",
      "User-Agent": US_RECORDS_UA,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`${options.source} HTTP ${res.status}`);
  }

  return res.text();
}
