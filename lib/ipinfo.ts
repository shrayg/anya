/**
 * IPInfo geolocation / ASN client (ipinfo.io).
 *
 * Upstream (in priority order):
 * 1. Direct IPINFO_TOKEN / IPINFO_API_KEY (+ optional IPINFO_BASE_URL)
 * 2. BreachHub GET /api/ipinfo (BREACHHUB_API_KEY)
 *
 * Classic: GET https://ipinfo.io/{ip}?token=
 * Newer API base (api.ipinfo.io): GET {base}/lookup/{ip}?token=
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import { isIP } from "node:net";

import { breachHubGet, isBreachHubEnabled } from "@/lib/breachhub";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { recordProviderRequest } from "@/lib/provider-request-log";

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const DEFAULT_BASE = "https://ipinfo.io";

export type IpInfoLookupResult = {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
  asn?: string;
  source: "direct" | "breachhub";
  raw: Record<string, unknown>;
};

export function getIpInfoToken(): string | undefined {
  const token =
    process.env.IPINFO_TOKEN?.trim() || process.env.IPINFO_API_KEY?.trim();

  return token || undefined;
}

export function getIpInfoBaseUrl(): string {
  const base = process.env.IPINFO_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct IPInfo token is configured. */
export function hasDirectIpInfoToken(): boolean {
  return Boolean(getIpInfoToken());
}

export function isIpInfoEnabled(): boolean {
  if (process.env.IPINFO_ENABLED === "false") return false;

  return hasDirectIpInfoToken() || isBreachHubEnabled();
}

export function normalizeIpInfoQuery(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) return null;
  if (isIP(trimmed) === 0) return null;

  return trimmed;
}

function sanitizeIpInfoError(message: string): string {
  const cleaned = sanitizePublicText(message).trim();

  if (!cleaned) return publicSearchError();

  const lower = cleaned.toLowerCase();

  if (
    lower.includes("quota") ||
    lower.includes("credit") ||
    (lower.includes("limit") &&
      (lower.includes("exceed") ||
        lower.includes("reached") ||
        lower.includes("daily")))
  ) {
    return "Provider quota exceeded for this source. Try again later.";
  }
  if (
    (lower.includes("rate") &&
      (lower.includes("limit") || lower.includes("429"))) ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid token") ||
    lower.includes("invalid api") ||
    lower.includes("api key") ||
    lower.includes("auth failed") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed || undefined;
}

function extractAsn(payload: Record<string, unknown>): string | undefined {
  const direct = asOptionalString(payload.asn);
  if (direct) return direct;

  const org = asOptionalString(payload.org);
  if (org) {
    const match = org.match(/\bAS\d+\b/i);
    if (match) return match[0].toUpperCase();
  }

  const as = payload.as;
  if (as && typeof as === "object" && !Array.isArray(as)) {
    const asn = asOptionalString((as as Record<string, unknown>).asn);
    if (asn) return asn;
  }

  return undefined;
}

function normalizePayload(
  payload: Record<string, unknown>,
  ip: string,
  source: "direct" | "breachhub",
): IpInfoLookupResult {
  let record = payload;
  for (const key of ["data", "result", "ipinfo", "lookup"] as const) {
    const nested = payload[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      record = nested as Record<string, unknown>;
      break;
    }
  }

  const resolvedIp = asOptionalString(record.ip) || ip;

  return {
    ip: resolvedIp,
    hostname: asOptionalString(record.hostname),
    city: asOptionalString(record.city),
    region: asOptionalString(record.region),
    country: asOptionalString(record.country),
    loc: asOptionalString(record.loc),
    org: asOptionalString(record.org),
    postal: asOptionalString(record.postal),
    timezone: asOptionalString(record.timezone),
    asn: extractAsn(record),
    source,
    raw: record,
  };
}

function buildDirectLookupUrl(ip: string, token: string): URL {
  const base = getIpInfoBaseUrl();
  const host = base.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  const isApiHost = /api\.ipinfo\.io$/i.test(host);

  const path = isApiHost
    ? `/lookup/${encodeURIComponent(ip)}`
    : `/${encodeURIComponent(ip)}`;

  const url = new URL(`${base}${path}`);
  url.searchParams.set("token", token);

  return url;
}

async function fetchIpInfoDirect(
  ip: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const token = getIpInfoToken();

  if (!token) {
    throw new Error(publicServiceUnavailable());
  }

  const url = buildDirectLookupUrl(ip, token);
  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "ipinfo",
      path: url.pathname,
      method: "GET",
      ok,
      latencyMs: Date.now() - started,
      statusCode: opts?.statusCode,
      error: opts?.error,
    });
  };

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AnyaInt-IPInfo/1.0",
      },
      cache: "no-store",
      timeoutMs,
    });

    const remaining = Math.max(2_000, timeoutMs - (Date.now() - started));
    const text = await readResponseText(res, remaining);
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      const errMsg = !res.ok
        ? sanitizeIpInfoError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        (typeof data.title === "string" && data.title) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeIpInfoError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Lookup failed";
      const errMsg = sanitizeIpInfoError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    logRequest(true, { statusCode: res.status });

    return data;
  } catch (err) {
    logRequest(false, {
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err;
  }
}

/**
 * Raw IPInfo GET — prefers direct token, else BreachHub proxy.
 */
export async function fetchIpInfo(
  ip: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isIpInfoEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const normalized = normalizeIpInfoQuery(ip);

  if (!normalized) {
    throw new Error("Enter a valid IPv4 or IPv6 address.");
  }

  if (hasDirectIpInfoToken()) {
    const data = await fetchIpInfoDirect(normalized, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    "/api/ipinfo",
    { ip: normalized },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Normalized IPInfo lookup for UI / specialty consumers. */
export async function lookupIpInfo(
  ip: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<IpInfoLookupResult> {
  const normalized = normalizeIpInfoQuery(ip);

  if (!normalized) {
    throw new Error("Enter a valid IPv4 or IPv6 address.");
  }

  const { data, source } = await fetchIpInfo(normalized, timeoutMs);

  return normalizePayload(data, normalized, source);
}
