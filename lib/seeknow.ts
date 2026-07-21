/**
 * SeekNow (See-Know) client — breach search, stealer, Discord, username,
 * network, domain, and gaming lookups.
 *
 * Upstream (in priority order):
 * 1. Direct SEEKNOW_API_KEY (+ optional SEEKNOW_BASE_URL)
 * 2. BreachHub /api/seeknow/* (BREACHHUB_API_KEY)
 *
 * Site routes: POST for search/stealer; GET for specialty lookups.
 * Direct/BH upstream follows the same methods (OpenAPI).
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

/** Relative paths under /api/seeknow/ exposed on this site. */
export const SEEKNOW_ENDPOINTS = [
  "search",
  "stealer",
  "discord/user",
  "discord/to-roblox",
  "username/github",
  "username/twitter",
  "username/tiktok",
  "username/reddit",
  "username/social",
  "username/history",
  "network/ip",
  "network/email-check",
  "network/phone",
  "domain/intel",
  "domain/whois",
  "gaming/xbox",
  "gaming/roblox",
  "gaming/minecraft",
] as const;

export type SeekNowEndpoint = (typeof SEEKNOW_ENDPOINTS)[number];

export type SeekNowHttpMethod = "GET" | "POST";

export type SeekNowSearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "breachhub";
  endpoint: SeekNowEndpoint;
  raw?: Record<string, unknown>;
};

const ENDPOINT_SET = new Set<string>(SEEKNOW_ENDPOINTS);

/** BreachHub catalog ids that mirror SeekNow when a direct key is set. */
export const SEEKNOW_BREACHHUB_ENDPOINT_IDS = [
  "seeknow-search",
  "seeknow-stealer",
  "seeknow-stealer-legacy",
  "seeknow-discord-user",
  "seeknow-discord-roblox",
  "seeknow-github",
  "seeknow-twitter",
  "seeknow-tiktok",
  "seeknow-reddit",
  "seeknow-social",
  "seeknow-history",
  "seeknow-ip",
  "seeknow-email-check",
  "seeknow-phone",
  "seeknow-domain-intel",
  "seeknow-domain-whois",
  "seeknow-xbox",
  "seeknow-roblox",
  "seeknow-minecraft",
] as const;

export function isSeekNowEndpoint(value: string): value is SeekNowEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase().replace(/^\/+|\/+$/g, ""));
}

export function normalizeSeekNowPath(pathParts: string[]): string {
  return pathParts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function getSeekNowApiKey(): string | undefined {
  const key = process.env.SEEKNOW_API_KEY?.trim();

  return key || undefined;
}

export function getSeekNowBaseUrl(): string {
  const base = process.env.SEEKNOW_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct SeekNow key is configured. */
export function hasDirectSeekNowKey(): boolean {
  return Boolean(getSeekNowApiKey());
}

export function isSeekNowEnabled(): boolean {
  if (process.env.SEEKNOW_ENABLED === "false") return false;

  return hasDirectSeekNowKey() || isBreachHubEnabled();
}

export function seekNowMethodForEndpoint(
  endpoint: SeekNowEndpoint,
): SeekNowHttpMethod {
  if (endpoint === "search" || endpoint === "stealer") return "POST";

  return "GET";
}

function sanitizeSeekNowError(message: string): string {
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
    lower.includes("auth failed") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

function toSanitized(
  payload: unknown,
  query: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (query.trim()) {
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  }

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

/**
 * Build upstream query/body params from a loose client query + extras.
 * Accepts either the OpenAPI field names or a generic `query`.
 */
export function buildSeekNowParams(
  endpoint: SeekNowEndpoint,
  input: Record<string, string>,
): Record<string, string> | null {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = input[key]?.trim();

      if (value) return value;
    }

    return "";
  };

  const out: Record<string, string> = {};

  switch (endpoint) {
    case "search": {
      const query = pick("query", "q", "term");

      if (!query) return null;
      out.query = query;
      const type = pick("type", "seeknow_type");

      if (type) out.type = type;
      const limit = pick("limit");

      if (limit) out.limit = limit;

      return out;
    }
    case "stealer": {
      const query = pick("query", "q", "term", "email", "username", "domain");

      if (!query) return null;
      out.query = query;
      const limit = pick("limit");

      if (limit) out.limit = limit;

      return out;
    }
    case "discord/user":
    case "discord/to-roblox": {
      const discordId = pick("discord_id", "discordId", "query", "id");

      if (!discordId) return null;
      out.discord_id = discordId;

      return out;
    }
    case "username/github":
    case "username/twitter":
    case "username/tiktok":
    case "username/reddit":
    case "username/social":
    case "username/history": {
      const username = pick("username", "query", "user", "handle");

      if (!username) return null;
      out.username = username.replace(/^@/, "");
      const platforms = pick("platforms");

      if (endpoint === "username/social" && platforms) {
        out.platforms = platforms;
      }

      return out;
    }
    case "network/ip": {
      const ip = pick("ip", "query");

      if (!ip) return null;
      out.ip = ip;

      return out;
    }
    case "network/email-check": {
      const email = pick("email", "query");

      if (!email) return null;
      out.email = email;

      return out;
    }
    case "network/phone": {
      const phone = pick("phone", "query");

      if (!phone) return null;
      out.phone = phone;

      return out;
    }
    case "domain/intel":
    case "domain/whois": {
      const domain = pick("domain", "query");

      if (!domain) return null;
      out.domain = domain;

      return out;
    }
    case "gaming/xbox": {
      const gamertag = pick("gamertag", "username", "query");

      if (!gamertag) return null;
      out.gamertag = gamertag;

      return out;
    }
    case "gaming/roblox": {
      const username = pick("username", "query");
      const userId = pick("user_id", "userId", "id");

      if (!username && !userId) return null;
      if (username) out.username = username;
      if (userId) out.user_id = userId;

      return out;
    }
    case "gaming/minecraft": {
      const username = pick("username", "query");

      if (!username) return null;
      out.username = username;

      return out;
    }
    default:
      return null;
  }
}

/** Primary display/query string for response envelopes. */
export function seekNowPrimaryQuery(
  endpoint: SeekNowEndpoint,
  params: Record<string, string>,
): string {
  return (
    params.query ||
    params.discord_id ||
    params.username ||
    params.email ||
    params.phone ||
    params.ip ||
    params.domain ||
    params.gamertag ||
    params.user_id ||
    ""
  );
}

async function seekNowHttp(
  endpoint: SeekNowEndpoint,
  params: Record<string, string>,
  method: SeekNowHttpMethod,
  timeoutMs: number,
  mode: "direct" | "breachhub",
): Promise<Record<string, unknown>> {
  const apiKey =
    mode === "direct" ? getSeekNowApiKey() : process.env.BREACHHUB_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const base = mode === "direct" ? getSeekNowBaseUrl() : DEFAULT_BASE;
  const path = `/api/seeknow/${endpoint}`;
  const url = new URL(`${base}${path}`);

  url.searchParams.set("key", apiKey);

  let body: string | undefined;

  if (method === "POST") {
    body = JSON.stringify(params);
  } else {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
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
      gateway: mode === "direct" ? "seeknow" : "breachhub",
      path,
      method,
      ok,
      latencyMs: Date.now() - started,
      statusCode: opts?.statusCode,
      error: opts?.error,
    });
  };

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": "AnyaInt-SeekNow/1.0",
        ...(body
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body,
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
        ? sanitizeSeekNowError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeSeekNowError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeSeekNowError(msg);

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
 * Raw SeekNow call — prefers direct key, else BreachHub.
 * POST endpoints fall back to GET on BreachHub when POST is rejected.
 */
export async function fetchSeekNow(
  endpoint: SeekNowEndpoint,
  params: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isSeekNowEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const method = seekNowMethodForEndpoint(endpoint);

  if (hasDirectSeekNowKey()) {
    const data = await seekNowHttp(endpoint, params, method, timeoutMs, "direct");

    return { data, source: "direct" };
  }

  if (method === "GET") {
    const data = await breachHubGet(`/api/seeknow/${endpoint}`, params, timeoutMs);

    return { data, source: "breachhub" };
  }

  try {
    const data = await seekNowHttp(
      endpoint,
      params,
      "POST",
      timeoutMs,
      "breachhub",
    );

    return { data, source: "breachhub" };
  } catch {
    // Some BH plans only expose SeekNow search via GET query params.
    const data = await breachHubGet(`/api/seeknow/${endpoint}`, params, timeoutMs);

    return { data, source: "breachhub" };
  }
}

/** Sanitized SeekNow lookup for UI / specialty consumers. */
export async function fetchSeekNowSanitized(
  endpoint: SeekNowEndpoint,
  input: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SeekNowSearchResult> {
  const params = buildSeekNowParams(endpoint, input);

  if (!params) {
    return {
      count: 0,
      results: [],
      query: "",
      source: "breachhub",
      endpoint,
    };
  }

  const query = seekNowPrimaryQuery(endpoint, params);
  const { data, source } = await fetchSeekNow(endpoint, params, timeoutMs);
  const sanitized = toSanitized(data, query);

  return {
    ...sanitized,
    query,
    source,
    endpoint,
    raw: data,
  };
}

/** Plan module slug defaults for /api/seeknow/<path> billing. */
export function seekNowModuleSlugForEndpoint(endpoint: SeekNowEndpoint): string {
  switch (endpoint) {
    case "search":
      return "breaches";
    case "stealer":
      return "stealer-logs";
    case "discord/user":
    case "discord/to-roblox":
      return "discord-id";
    case "username/github":
      return "github";
    case "username/twitter":
      return "twitter";
    case "username/tiktok":
      return "tiktok-recon";
    case "username/reddit":
      return "reddit";
    case "username/social":
    case "username/history":
      return "username";
    case "network/ip":
      return "ip";
    case "network/email-check":
      return "email-analyze";
    case "network/phone":
      return "phone";
    case "domain/intel":
    case "domain/whois":
      return "domains";
    case "gaming/xbox":
      return "xbox";
    case "gaming/roblox":
      return "roblox";
    case "gaming/minecraft":
      return "minecraft";
    default:
      return "breaches";
  }
}

export async function probeSeekNow(): Promise<boolean> {
  if (!isSeekNowEnabled()) return false;

  try {
    const { data } = await fetchSeekNow(
      "network/ip",
      { ip: "1.1.1.1" },
      8_000,
    );

    return Boolean(data && typeof data === "object");
  } catch {
    return false;
  }
}
