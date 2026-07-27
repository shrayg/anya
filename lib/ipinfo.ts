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

  // BreachHub /api/ipinfo v2 shape: { location, network, reverse_dns, query }
  const location =
    record.location && typeof record.location === "object"
      ? (record.location as Record<string, unknown>)
      : null;
  const network =
    record.network && typeof record.network === "object"
      ? (record.network as Record<string, unknown>)
      : null;

  const lat = location
    ? Number(location.latitude ?? location.lat)
    : Number(record.latitude ?? record.lat);
  const lng = location
    ? Number(location.longitude ?? location.lon ?? location.lng)
    : Number(record.longitude ?? record.lon ?? record.lng);
  const locFromCoords =
    Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : undefined;

  const city =
    asOptionalString(record.city) ||
    (location ? asOptionalString(location.city) : undefined);
  const region =
    asOptionalString(record.region) ||
    (location
      ? asOptionalString(location.region) ||
        asOptionalString(location.region_code)
      : undefined);
  const country =
    asOptionalString(record.country) ||
    (location
      ? asOptionalString(location.country_code) ||
        asOptionalString(location.country)
      : undefined);
  const org =
    asOptionalString(record.org) ||
    (network
      ? asOptionalString(network.organization) ||
        asOptionalString(network.isp) ||
        asOptionalString(network.as_number)
      : undefined);
  const postal =
    asOptionalString(record.postal) ||
    (location ? asOptionalString(location.zip) : undefined);
  const timezone =
    asOptionalString(record.timezone) ||
    (location ? asOptionalString(location.timezone) : undefined);
  const hostname =
    asOptionalString(record.hostname) ||
    asOptionalString(record.reverse_dns);
  const asn =
    extractAsn(record) ||
    (network ? asOptionalString(network.as_number) : undefined);

  const resolvedIp =
    asOptionalString(record.ip) ||
    asOptionalString(record.query) ||
    asOptionalString(payload.query) ||
    ip;

  return {
    ip: resolvedIp,
    hostname,
    city,
    region,
    country,
    loc: asOptionalString(record.loc) || locFromCoords,
    org,
    postal,
    timezone,
    asn,
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
 * Throws when neither premium source is available (caller may use free fallback).
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

/** Free HTTPS geo fallback (no API key) when IPInfo / BreachHub are unavailable. */
async function fetchFreeIpGeoFallback(
  ip: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
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
      path: `/fallback/ipwho.is/${ip}`,
      method: "GET",
      ok,
      latencyMs: Date.now() - started,
      statusCode: opts?.statusCode,
      error: opts?.error,
    });
  };

  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AnyaInt-IPGeo/1.0",
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
      logRequest(false, { statusCode: res.status, error: "Invalid JSON" });
      throw new Error(publicSearchError("Invalid response from intelligence index."));
    }

    if (!res.ok || data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        `HTTP ${res.status}`;
      logRequest(false, { statusCode: res.status, error: msg });
      throw new Error(sanitizeIpInfoError(msg));
    }

    logRequest(true, { statusCode: res.status });

    const connection =
      data.connection && typeof data.connection === "object"
        ? (data.connection as Record<string, unknown>)
        : {};
    const lat = data.latitude;
    const lng = data.longitude;
    const loc =
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
        ? `${lat},${lng}`
        : undefined;
    const asnRaw = connection.asn;
    const asn =
      typeof asnRaw === "number"
        ? `AS${asnRaw}`
        : typeof asnRaw === "string"
          ? asnRaw
          : undefined;
    const isp =
      (typeof connection.isp === "string" && connection.isp) ||
      (typeof connection.org === "string" && connection.org) ||
      undefined;

    return {
      ip: (typeof data.ip === "string" && data.ip) || ip,
      city: typeof data.city === "string" ? data.city : undefined,
      region: typeof data.region === "string" ? data.region : undefined,
      country:
        (typeof data.country_code === "string" && data.country_code) ||
        (typeof data.country === "string" && data.country) ||
        undefined,
      loc,
      org: isp,
      postal: typeof data.postal === "string" ? data.postal : undefined,
      timezone:
        data.timezone && typeof data.timezone === "object"
          ? asOptionalString((data.timezone as Record<string, unknown>).id)
          : asOptionalString(data.timezone),
      asn,
      hostname: asOptionalString(connection.domain),
    };
  } catch (err) {
    logRequest(false, {
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err;
  }
}

/** Normalized IP geo lookup — IPInfo / BreachHub, then free fallback. */
export async function lookupIpInfo(
  ip: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<IpInfoLookupResult> {
  const normalized = normalizeIpInfoQuery(ip);

  if (!normalized) {
    throw new Error("Enter a valid IPv4 or IPv6 address.");
  }

  if (isIpInfoEnabled()) {
    try {
      const { data, source } = await fetchIpInfo(normalized, timeoutMs);

      return normalizePayload(data, normalized, source);
    } catch {
      // Fall through to free geo.
    }
  }

  const fallback = await fetchFreeIpGeoFallback(
    normalized,
    Math.min(timeoutMs, 12_000),
  );

  return normalizePayload(fallback, normalized, "breachhub");
}
