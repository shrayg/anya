/**
 * Seekria client — footprint, breach, Discord, gaming, and TikTok lookups.
 *
 * Upstream (in priority order):
 * 1. Direct SEEKRIA_API_KEY (+ optional SEEKRIA_BASE_URL)
 * 2. BreachHub GET /api/seekria/* (BREACHHUB_API_KEY)
 *
 * Site routes stay GET matching BreachHub OpenAPI paths.
 */

import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
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

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const DEFAULT_BASE = "https://breachhub.org";

/** All Seekria paths exposed on this site (OpenAPI / BreachHub catalog). */
export const SEEKRIA_ENDPOINTS = [
  "user-footprint",
  "email-osint",
  "domain-lookup",
  "discord",
  "roblox",
  "minecraft",
  "ip",
  "dns-resolver",
  "email-breach",
  "username-breach",
  "phone-breach",
  "discord-profile",
  "discord-to-rat",
  "fivem",
  "minecraft-osint",
  "name-history",
  "laby-stats",
  "minecraft-texture",
  "tiktok-lookup",
  "tiktok-breach",
  "snusbase-breach",
  "leakcheck-breach",
] as const;

export type SeekriaEndpoint = (typeof SEEKRIA_ENDPOINTS)[number];

export type SeekriaSearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const ENDPOINT_SET = new Set<string>(SEEKRIA_ENDPOINTS);

export function isSeekriaEndpoint(value: string): value is SeekriaEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function getSeekriaApiKey(): string | undefined {
  const key = process.env.SEEKRIA_API_KEY?.trim();

  return key || undefined;
}

export function getSeekriaBaseUrl(): string {
  const base = process.env.SEEKRIA_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Seekria key is configured. */
export function hasDirectSeekriaKey(): boolean {
  return Boolean(getSeekriaApiKey());
}

export function isSeekriaEnabled(): boolean {
  if (process.env.SEEKRIA_ENABLED === "false") return false;

  return hasDirectSeekriaKey() || isBreachHubEnabled();
}

function sanitizeSeekriaError(message: string): string {
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
    lower.includes("invalid api") ||
    lower.includes("api key") ||
    lower.includes("401")
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

/** Infer FiveM `type` when the client omits it. */
export function detectSeekriaFivemType(query: string): string {
  const q = query.trim();

  if (/^\d{17,20}$/.test(q)) return "discord";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(q)) return "ip";
  if (/^steam:/i.test(q) || /^7656119\d+$/.test(q)) return "steam";
  if (/^license:/i.test(q)) return "license";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
    return "uuid";
  }

  return "username";
}

function toSanitized(
  payload: unknown,
  query: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (query.trim()) {
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  }

  // Non-list payloads (profile objects) — keep as a single result row.
  if (
    results.length === 0 &&
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    const record = payload as Record<string, unknown>;
    const hasUseful =
      record.data != null ||
      record.result != null ||
      record.profile != null ||
      record.user != null ||
      Object.keys(record).some(
        (key) =>
          !["success", "message", "error", "status", "ok"].includes(key),
      );

    if (hasUseful) {
      results = scrubIntelResults([payload]);
    }
  }

  return { count: results.length, results };
}

async function fetchSeekriaDirect(
  endpoint: SeekriaEndpoint,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getSeekriaApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getSeekriaBaseUrl()}/api/seekria/${endpoint}`);

  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "seekria",
      path: `/api/seekria/${endpoint}`,
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
        "User-Agent": "AnyaInt-Seekria/1.0",
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
        ? sanitizeSeekriaError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeSeekriaError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeSeekriaError(msg);

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
 * Raw Seekria GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchSeekria(
  endpoint: SeekriaEndpoint,
  params: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isSeekriaEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  if (hasDirectSeekriaKey()) {
    const data = await fetchSeekriaDirect(endpoint, params, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    `/api/seekria/${endpoint}`,
    params,
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/**
 * Sanitized Seekria lookup for UI / specialty consumers.
 */
export async function fetchSeekriaSanitized(
  endpoint: SeekriaEndpoint,
  query: string,
  extraParams: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SeekriaSearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    return { count: 0, results: [], query: trimmed, source: "breachhub" };
  }

  const params: Record<string, string> = { query: trimmed, ...extraParams };

  if (endpoint === "fivem" && !params.type) {
    params.type = detectSeekriaFivemType(trimmed);
  }

  if (endpoint === "tiktok-lookup" && !params.type) {
    params.type = "full";
  }

  const { data, source } = await fetchSeekria(endpoint, params, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    source,
    raw: data,
  };
}

/** Plan module slug defaults for /api/seekria/<endpoint> billing. */
export function seekriaModuleSlugForEndpoint(endpoint: SeekriaEndpoint): string {
  switch (endpoint) {
    case "discord":
    case "discord-profile":
    case "discord-to-rat":
      return "discord-id";
    case "roblox":
      return "roblox";
    case "minecraft":
    case "minecraft-osint":
    case "name-history":
    case "laby-stats":
    case "minecraft-texture":
      return "minecraft";
    case "fivem":
      return "fivem";
    case "tiktok-lookup":
    case "tiktok-breach":
      return "tiktok-recon";
    case "ip":
      return "ip";
    case "domain-lookup":
    case "dns-resolver":
      return "domains";
    case "email-osint":
      return "email-analyze";
    case "user-footprint":
      return "username";
    case "email-breach":
    case "username-breach":
    case "phone-breach":
    case "snusbase-breach":
    case "leakcheck-breach":
      return "breaches";
    default:
      return "breaches";
  }
}
