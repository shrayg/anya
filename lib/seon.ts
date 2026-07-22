/** Server-only SEON fraud-intelligence client. */
import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  fetchCsintSeonEmail,
  fetchCsintSeonPhone,
  isCsintEnabled,
  normalizeSeonFootprint,
} from "@/lib/csint";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import {
  filterIntelResultsForQuery,
  scrubIntelResults,
} from "@/lib/intel-record";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { recordProviderRequest } from "@/lib/provider-request-log";

const DEFAULT_BASE = "https://api.seon.io/SeonRestService/fraud-api/v2.0";
const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
export const SEON_ENDPOINTS = [
  "phone",
  "email",
  "ip",
  "bin",
  "email-verification",
] as const;
export type SeonEndpoint = (typeof SEON_ENDPOINTS)[number];
const ENDPOINT_SET = new Set<string>(SEON_ENDPOINTS);
const PARAM_BY_ENDPOINT: Record<SeonEndpoint, string> = {
  phone: "phone",
  email: "email",
  ip: "ip",
  bin: "bin",
  "email-verification": "email",
};
export type SeonSearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "gateway" | "breachhub" | "csint";
  raw?: Record<string, unknown>;
};

export function isSeonEndpoint(value: string): value is SeonEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}
export function getSeonApiKey(): string | undefined {
  return process.env.SEON_API_KEY?.trim() || undefined;
}
export function getSeonBaseUrl(): string {
  return (process.env.SEON_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}
export function isOfficialSeonBase(): boolean {
  try {
    return new URL(getSeonBaseUrl()).hostname.toLowerCase().endsWith("seon.io");
  } catch {
    return false;
  }
}
export function hasDirectSeonKey(): boolean {
  return Boolean(getSeonApiKey());
}
export function isSeonEnabled(): boolean {
  return (
    process.env.SEON_ENABLED !== "false" &&
    (hasDirectSeonKey() || isBreachHubEnabled() || isCsintEnabled())
  );
}
function sanitizeError(message: string): string {
  const clean = sanitizePublicText(message).trim();
  if (!clean) return publicSearchError();
  return /(?:unauthori[sz]ed|api key|\b401\b|\b403\b)/i.test(clean)
    ? publicServiceUnavailable()
    : clean;
}
function rows(payload: unknown, query: string): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));
  if (query)
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  if (
    !results.length &&
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    const r = payload as Record<string, unknown>;
    if (
      Object.keys(r).some(
        (k) => !["success", "message", "error", "status", "ok"].includes(k),
      )
    )
      results = scrubIntelResults([r]);
  }
  return { count: results.length, results };
}
async function request(
  url: URL,
  init: RequestInit,
  endpoint: SeonEndpoint,
  timeoutMs: number,
  source: "direct" | "gateway",
): Promise<Record<string, unknown>> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(url.toString(), {
      ...init,
      cache: "no-store",
      timeoutMs,
    });
    const text = await readResponseText(
      res,
      Math.max(2_000, timeoutMs - (Date.now() - started)),
    );
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(
        res.ok
          ? publicSearchError("Invalid response from intelligence index.")
          : `HTTP ${res.status}`,
      );
    }
    if (!res.ok || data.success === false)
      throw new Error(
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status}`,
      );
    recordProviderRequest({
      gateway: "seon",
      path: `/api/seon/${endpoint}`,
      method: init.method || "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });
    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: "seon",
      path: `/api/seon/${endpoint}`,
      method: init.method || "GET",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw new Error(
      sanitizeError(err instanceof Error ? err.message : "Request failed"),
    );
  }
}
async function direct(
  endpoint: SeonEndpoint,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const key = getSeonApiKey();
  if (!key) throw new Error(publicServiceUnavailable());
  const official = isOfficialSeonBase();
  const url = new URL(
    official
      ? `${getSeonBaseUrl()}/${endpoint}`
      : `${getSeonBaseUrl()}/api/seon/${endpoint}`,
  );
  if (!official) {
    url.searchParams.set("key", key);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
    return request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "AnyaInt-SEON/1.0",
        },
      },
      endpoint,
      timeoutMs,
      "gateway",
    );
  }
  const post = ["email", "phone", "ip"].includes(endpoint);
  if (post)
    return request(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": key,
          "User-Agent": "AnyaInt-SEON/1.0",
        },
        body: JSON.stringify(params),
      },
      endpoint,
      timeoutMs,
      "direct",
    );
  url.searchParams.set("api_key", key);
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  return request(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": key,
        "User-Agent": "AnyaInt-SEON/1.0",
      },
    },
    endpoint,
    timeoutMs,
    "direct",
  );
}
export async function fetchSeon(
  endpoint: SeonEndpoint,
  params: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{
  data: Record<string, unknown>;
  source: SeonSearchResult["source"];
}> {
  if (!isSeonEnabled()) throw new Error(publicServiceUnavailable());
  if (hasDirectSeonKey())
    return {
      data: await direct(endpoint, params, timeoutMs),
      source: isOfficialSeonBase() ? "direct" : "gateway",
    };
  if (isBreachHubEnabled())
    return {
      data: await breachHubGet(`/api/seon/${endpoint}`, params, timeoutMs),
      source: "breachhub",
    };
  if ((endpoint === "email" || endpoint === "phone") && isCsintEnabled()) {
    const data =
      endpoint === "email"
        ? await fetchCsintSeonEmail(params.email || "")
        : await fetchCsintSeonPhone(params.phone || "");
    return { data, source: "csint" };
  }
  throw new Error(publicServiceUnavailable());
}
export async function fetchSeonSanitized(
  endpoint: SeonEndpoint,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SeonSearchResult> {
  const trimmed = query.trim();
  if (!trimmed)
    return { count: 0, results: [], query: trimmed, source: "breachhub" };
  const params = { [PARAM_BY_ENDPOINT[endpoint]]: trimmed };
  let result = await fetchSeon(endpoint, params, timeoutMs);
  let sanitized =
    result.source === "csint" && (endpoint === "email" || endpoint === "phone")
      ? normalizeSeonFootprint(result.data, endpoint)
      : rows(result.data, trimmed);
  if (
    !sanitized.count &&
    result.source !== "csint" &&
    (endpoint === "email" || endpoint === "phone") &&
    isCsintEnabled()
  ) {
    const fallback =
      endpoint === "email"
        ? await fetchCsintSeonEmail(trimmed)
        : await fetchCsintSeonPhone(trimmed);
    sanitized = normalizeSeonFootprint(fallback, endpoint);
    result = { data: fallback, source: "csint" };
  }
  return {
    ...sanitized,
    query: trimmed,
    source: result.source,
    raw: result.data,
  };
}
export function seonModuleSlugForEndpoint(endpoint: SeonEndpoint): string {
  return endpoint === "ip"
    ? "ip"
    : endpoint === "bin"
      ? "bin-lookup"
      : "fraud-footprint";
}
