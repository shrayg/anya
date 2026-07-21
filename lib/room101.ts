/**
 * Room101 client — Reddit user, subreddit, search, and AI analyze.
 *
 * Upstream (in priority order):
 * 1. Direct ROOM101_API_KEY (+ optional ROOM101_BASE_URL)
 * 2. BreachHub GET /api/room101/* (BREACHHUB_API_KEY)
 *
 * OpenAPI paths (all GET):
 *   /api/room101/analyze?username=
 *   /api/room101/search?query=
 *   /api/room101/v2/search?query=
 *   /api/room101/user?username=
 *   /api/room101/subreddit?name=
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
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

/** Relative paths under /api/room101/ exposed on this site. */
export const ROOM101_ENDPOINTS = [
  "analyze",
  "search",
  "v2/search",
  "user",
  "subreddit",
] as const;

export type Room101Endpoint = (typeof ROOM101_ENDPOINTS)[number];

export type Room101SearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "breachhub";
  endpoint: Room101Endpoint;
  raw?: Record<string, unknown>;
};

/** BreachHub catalog ids that mirror Room101 when a direct key is set. */
export const ROOM101_BREACHHUB_MIRROR_IDS = [
  "room101-user",
  "room101-analyze",
  "room101-search-legacy",
  "room101-search",
  "room101-subreddit",
] as const;

const ENDPOINT_SET = new Set<string>(ROOM101_ENDPOINTS);

export function isRoom101Endpoint(value: string): value is Room101Endpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function normalizeRoom101Path(pathParts: string[]): string {
  return pathParts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function getRoom101ApiKey(): string | undefined {
  const key = process.env.ROOM101_API_KEY?.trim();

  return key || undefined;
}

export function getRoom101BaseUrl(): string {
  const base = process.env.ROOM101_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Room101 key is configured. */
export function hasDirectRoom101Key(): boolean {
  return Boolean(getRoom101ApiKey());
}

export function isRoom101Enabled(): boolean {
  if (process.env.ROOM101_ENABLED === "false") return false;

  return hasDirectRoom101Key() || isBreachHubEnabled();
}

function sanitizeRoom101Error(message: string): string {
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

  // Profile / analyze objects — keep as a single result row.
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
      record.analysis != null ||
      record.subreddit != null ||
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
 * Build upstream query params from a loose client query + extras.
 * Accepts OpenAPI field names or a generic `query` from the module UI.
 */
export function buildRoom101Params(
  endpoint: Room101Endpoint,
  input: Record<string, string>,
): Record<string, string> | null {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = input[key]?.trim();

      if (value) return value;
    }

    return "";
  };

  switch (endpoint) {
    case "analyze":
    case "user": {
      const username = pick("username", "query", "user", "handle")
        .replace(/^u\//i, "")
        .replace(/^@/, "");

      if (!username) return null;

      return { username };
    }
    case "search":
    case "v2/search": {
      const query = pick("query", "q", "term", "terms");

      if (!query) return null;

      return { query };
    }
    case "subreddit": {
      const name = pick("name", "subreddit", "query")
        .replace(/^r\//i, "")
        .replace(/^\/+/, "");

      if (!name) return null;

      return { name };
    }
    default:
      return null;
  }
}

/** Primary display/query string for response envelopes. */
export function room101PrimaryQuery(
  endpoint: Room101Endpoint,
  params: Record<string, string>,
): string {
  switch (endpoint) {
    case "analyze":
    case "user":
      return params.username ?? "";
    case "subreddit":
      return params.name ?? "";
    case "search":
    case "v2/search":
      return params.query ?? "";
    default:
      return "";
  }
}

async function fetchRoom101Direct(
  endpoint: Room101Endpoint,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getRoom101ApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getRoom101BaseUrl()}/api/room101/${endpoint}`);

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
      gateway: "room101",
      path: `/api/room101/${endpoint}`,
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
        "User-Agent": "AnyaInt-Room101/1.0",
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
        ? sanitizeRoom101Error(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeRoom101Error(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeRoom101Error(msg);

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
 * Raw Room101 GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchRoom101(
  endpoint: Room101Endpoint,
  params: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isRoom101Enabled()) {
    throw new Error(publicServiceUnavailable());
  }

  if (hasDirectRoom101Key()) {
    const data = await fetchRoom101Direct(endpoint, params, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    `/api/room101/${endpoint}`,
    params,
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Room101 lookup for UI / specialty consumers. */
export async function fetchRoom101Sanitized(
  endpoint: Room101Endpoint,
  input: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Room101SearchResult> {
  const params = buildRoom101Params(endpoint, input);

  if (!params) {
    return {
      count: 0,
      results: [],
      query: "",
      source: "breachhub",
      endpoint,
    };
  }

  const query = room101PrimaryQuery(endpoint, params);
  const { data, source } = await fetchRoom101(endpoint, params, timeoutMs);
  const sanitized = toSanitized(data, query);

  return {
    ...sanitized,
    query,
    source,
    endpoint,
    raw: data,
  };
}

/** Plan module slug defaults for /api/room101/<path> billing. */
export function room101ModuleSlugForEndpoint(
  endpoint: Room101Endpoint,
): string {
  switch (endpoint) {
    case "analyze":
    case "user":
    case "search":
    case "v2/search":
    case "subreddit":
      return "reddit";
    default:
      return "reddit";
  }
}

export async function probeRoom101(): Promise<boolean> {
  if (!isRoom101Enabled()) return false;

  try {
    const { data } = await fetchRoom101(
      "user",
      { username: "spez" },
      8_000,
    );

    return Boolean(data);
  } catch {
    return false;
  }
}
