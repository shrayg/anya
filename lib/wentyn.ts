/**
 * Wentyn stealer-log client — email / domain credential dumps.
 *
 * Upstream (in priority order):
 * 1. Direct WENTYN_API_KEY (+ optional WENTYN_BASE_URL)
 * 2. BreachHub GET /api/wentyn (BREACHHUB_API_KEY)
 *
 * OpenAPI: GET /api/wentyn?type=email|domain&query=
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const WENTYN_TYPES = ["email", "domain"] as const;

export type WentynType = (typeof WENTYN_TYPES)[number];

export type WentynSearchResult = SanitizedBreachResponse & {
  query: string;
  type: WentynType;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const TYPE_SET = new Set<string>(WENTYN_TYPES);

export function isWentynType(value: string): value is WentynType {
  return TYPE_SET.has(value.trim().toLowerCase());
}

export function getWentynApiKey(): string | undefined {
  const key = process.env.WENTYN_API_KEY?.trim();

  return key || undefined;
}

export function getWentynBaseUrl(): string {
  const base = process.env.WENTYN_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Wentyn key is configured. */
export function hasDirectWentynKey(): boolean {
  return Boolean(getWentynApiKey());
}

export function isWentynEnabled(): boolean {
  if (process.env.WENTYN_ENABLED === "false") return false;

  return hasDirectWentynKey() || isBreachHubEnabled();
}

/**
 * Infer OpenAPI `type` from a free-text query when the client omits it.
 * Emails win over bare domains (user@host.com → email).
 */
export function detectWentynType(
  query: string,
  hint?: string | null,
): WentynType {
  const h = (hint || "").trim().toLowerCase();

  if (isWentynType(h)) return h;

  const trimmed = query.trim();

  if (EMAIL_RE.test(trimmed)) return "email";
  if (DOMAIN_RE.test(trimmed)) return "domain";

  // Default: email path accepts most identifiers upstream rejects less harshly.
  return "email";
}

function sanitizeWentynError(message: string): string {
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

async function fetchWentynDirect(
  type: WentynType,
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getWentynApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getWentynBaseUrl()}/api/wentyn`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("type", type);
  url.searchParams.set("query", query);

  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "wentyn",
      path: "/api/wentyn",
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
        "User-Agent": "AnyaInt-Wentyn/1.0",
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
        ? sanitizeWentynError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeWentynError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeWentynError(msg);

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
 * Raw Wentyn GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchWentyn(
  type: WentynType,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isWentynEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error("Missing query");
  }

  if (hasDirectWentynKey()) {
    const data = await fetchWentynDirect(type, trimmed, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    "/api/wentyn",
    { type, query: trimmed },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Wentyn lookup for UI / specialty consumers. */
export async function fetchWentynSanitized(
  query: string,
  typeHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WentynSearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      type: "email",
      source: "breachhub",
    };
  }

  const type = detectWentynType(trimmed, typeHint);
  const { data, source } = await fetchWentyn(type, trimmed, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    type,
    source,
    raw: data,
  };
}
