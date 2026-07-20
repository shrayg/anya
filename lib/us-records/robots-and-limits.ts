import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export const PUBLIC_RECORDS_UA =
  "Anya.Int/1.0 (+https://anyaint.com; public-records research; contact support@anyaint.com)";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const SOURCE_LIMITS = {
  courtlistener: { timeoutMs: 12_000, ttlMs: 6 * 60 * 60 * 1000 },
  openfec: { timeoutMs: 10_000, ttlMs: 6 * 60 * 60 * 1000 },
  nppes: { timeoutMs: 10_000, ttlMs: 6 * 60 * 60 * 1000 },
  ofac: { timeoutMs: 30_000, ttlMs: 24 * 60 * 60 * 1000 },
  "va-sor": { timeoutMs: 20_000, ttlMs: 6 * 60 * 60 * 1000 },
  "va-ocis": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "de-courtconnect": { timeoutMs: 20_000, ttlMs: 6 * 60 * 60 * 1000 },
  "ok-oscn": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "fl-hover": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "dallas-wanted": { timeoutMs: 20_000, ttlMs: 6 * 60 * 60 * 1000 },
  "in-mycase": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "wi-ccap": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "pa-ujs": { timeoutMs: 35_000, ttlMs: 6 * 60 * 60 * 1000 },
  "fl-fdle": { timeoutMs: 30_000, ttlMs: 6 * 60 * 60 * 1000 },
  "eu-sanctions": { timeoutMs: 45_000, ttlMs: 24 * 60 * 60 * 1000 },
  "uk-sanctions": { timeoutMs: 45_000, ttlMs: 24 * 60 * 60 * 1000 },
  "ca-sanctions": { timeoutMs: 30_000, ttlMs: 24 * 60 * 60 * 1000 },
  "au-dfat": { timeoutMs: 45_000, ttlMs: 24 * 60 * 60 * 1000 },
  "ch-seco": { timeoutMs: 45_000, ttlMs: 24 * 60 * 60 * 1000 },
  "no-brreg": { timeoutMs: 12_000, ttlMs: 6 * 60 * 60 * 1000 },
  "sec-edgar": { timeoutMs: 15_000, ttlMs: 6 * 60 * 60 * 1000 },
  "eu-most-wanted": { timeoutMs: 20_000, ttlMs: 6 * 60 * 60 * 1000 },
  "worldbank-debarred": { timeoutMs: 25_000, ttlMs: 24 * 60 * 60 * 1000 },
  "tx-tdcj": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "fl-sunbiz": { timeoutMs: 30_000, ttlMs: 12 * 60 * 60 * 1000 },
  "nyc-pluto": { timeoutMs: 20_000, ttlMs: 12 * 60 * 60 * 1000 },
  "nyc-acris": { timeoutMs: 30_000, ttlMs: 12 * 60 * 60 * 1000 },
  "philly-opa": { timeoutMs: 20_000, ttlMs: 12 * 60 * 60 * 1000 },
  "kane-il-property": { timeoutMs: 20_000, ttlMs: 12 * 60 * 60 * 1000 },
  "nys-dos": { timeoutMs: 20_000, ttlMs: 12 * 60 * 60 * 1000 },
  "irs-eo": { timeoutMs: 15_000, ttlMs: 12 * 60 * 60 * 1000 },
  usaspending: { timeoutMs: 15_000, ttlMs: 12 * 60 * 60 * 1000 },
  "fbi-wanted": { timeoutMs: 12_000, ttlMs: 2 * 60 * 60 * 1000 },
  interpol: { timeoutMs: 15_000, ttlMs: 6 * 60 * 60 * 1000 },
  opensanctions: { timeoutMs: 15_000, ttlMs: 6 * 60 * 60 * 1000 },
  "un-sanctions": { timeoutMs: 30_000, ttlMs: 24 * 60 * 60 * 1000 },
  nsopw: { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "ca-rcmp-sor": { timeoutMs: 25_000, ttlMs: 6 * 60 * 60 * 1000 },
  "sam-gov": { timeoutMs: 15_000, ttlMs: 12 * 60 * 60 * 1000 },
  "bop-inmate": { timeoutMs: 20_000, ttlMs: 6 * 60 * 60 * 1000 },
  "state-portal": { timeoutMs: 5_000, ttlMs: 24 * 60 * 60 * 1000 },
  "country-portal": { timeoutMs: 5_000, ttlMs: 24 * 60 * 60 * 1000 },
} as const;

const lastCallAt = new Map<string, number>();

export async function paceSource(
  source: string,
  minIntervalMs: number,
): Promise<void> {
  const previous = lastCallAt.get(source) ?? 0;
  const wait = minIntervalMs - (Date.now() - previous);

  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCallAt.set(source, Date.now());
}

type FetchOpts = {
  source: keyof typeof SOURCE_LIMITS;
  headers?: Record<string, string>;
  minIntervalMs?: number;
  method?: "GET" | "POST";
  body?: string;
  userAgent?: string;
};

async function fetchPublicRecords(
  url: string,
  options: FetchOpts,
  accept: string,
): Promise<Response> {
  const limits = SOURCE_LIMITS[options.source];

  await paceSource(options.source, options.minIntervalMs ?? 250);

  return fetchWithTimeout(url, {
    method: options.method ?? "GET",
    cache: "no-store",
    timeoutMs: limits.timeoutMs,
    headers: {
      Accept: accept,
      "User-Agent": options.userAgent ?? PUBLIC_RECORDS_UA,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body,
  });
}

export async function fetchUsRecordsJson<T>(
  url: string,
  options: Omit<FetchOpts, "method" | "body"> & {
    method?: "GET" | "POST";
    body?: string;
  },
): Promise<T> {
  const res = await fetchPublicRecords(url, options, "application/json");

  if (!res.ok) {
    throw new Error(`${options.source} HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function fetchUsRecordsText(
  url: string,
  options: Omit<FetchOpts, "method" | "body">,
): Promise<string> {
  const res = await fetchPublicRecords(
    url,
    options,
    "text/html,text/csv,text/plain,application/xml,*/*",
  );

  if (!res.ok) {
    throw new Error(`${options.source} HTTP ${res.status}`);
  }

  return res.text();
}

export async function fetchUsRecordsPostJson<T>(
  url: string,
  options: {
    source: keyof typeof SOURCE_LIMITS;
    headers?: Record<string, string>;
    minIntervalMs?: number;
    userAgent?: string;
    body: unknown;
  },
): Promise<T> {
  const res = await fetchPublicRecords(
    url,
    {
      source: options.source,
      headers: options.headers,
      minIntervalMs: options.minIntervalMs,
      userAgent: options.userAgent,
      method: "POST",
      body: JSON.stringify(options.body),
    },
    "application/json",
  );

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      `${options.source} HTTP ${res.status}: ${text.slice(0, 120)}`,
    );
  }

  return (await res.json()) as T;
}

/** @deprecated Use PUBLIC_RECORDS_UA */
export const US_RECORDS_UA = PUBLIC_RECORDS_UA;
