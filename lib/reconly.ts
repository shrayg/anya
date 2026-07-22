/**
 * Reconly OSINT client — Discord / username / email / FiveM lookups.
 *
 * Upstream (in priority order):
 * 1. Direct RECONLY_API_KEY (+ optional RECONLY_BASE_URL)
 * 2. BreachHub GET /api/reconly (BREACHHUB_API_KEY)
 *
 * OpenAPI: GET /api/reconly?mode=discord|username|email|fivem&query=
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
import { isDiscordSnowflake } from "@/lib/osintcat";
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

export const RECONLY_MODES = [
  "discord",
  "username",
  "email",
  "fivem",
] as const;

export type ReconlyMode = (typeof RECONLY_MODES)[number];

export type ReconlySearchResult = SanitizedBreachResponse & {
  query: string;
  mode: ReconlyMode;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const MODE_SET = new Set<string>(RECONLY_MODES);

export function isReconlyMode(value: string): value is ReconlyMode {
  return MODE_SET.has(value.trim().toLowerCase());
}

export function getReconlyApiKey(): string | undefined {
  const key = process.env.RECONLY_API_KEY?.trim();

  return key || undefined;
}

export function getReconlyBaseUrl(): string {
  const base = process.env.RECONLY_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Reconly key is configured. */
export function hasDirectReconlyKey(): boolean {
  return Boolean(getReconlyApiKey());
}

export function isReconlyEnabled(): boolean {
  if (process.env.RECONLY_ENABLED === "false") return false;

  return hasDirectReconlyKey() || isBreachHubEnabled();
}

/**
 * Infer OpenAPI `mode` from a free-text query / UI scope when the client omits it.
 */
export function detectReconlyMode(
  query: string,
  hint?: string | null,
  scope?: string | null,
): ReconlyMode {
  const h = (hint || "").trim().toLowerCase();

  if (isReconlyMode(h)) return h;

  const s = (scope || "").trim().toLowerCase();

  if (s === "reconly-fivem" || s === "fivem" || s === "seekria-fivem") {
    return "fivem";
  }
  if (s === "discord-id" || s === "seekria-discord") {
    return "discord";
  }

  const trimmed = query.trim();

  if (EMAIL_RE.test(trimmed)) return "email";
  if (isDiscordSnowflake(trimmed)) return "discord";

  return "username";
}

function sanitizeReconlyError(message: string): string {
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

async function fetchReconlyDirect(
  mode: ReconlyMode,
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getReconlyApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getReconlyBaseUrl()}/api/reconly`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("mode", mode);
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
      gateway: "reconly",
      path: "/api/reconly",
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
        "User-Agent": "AnyaInt-Reconly/1.0",
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
        ? sanitizeReconlyError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeReconlyError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeReconlyError(msg);

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
 * Raw Reconly GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchReconly(
  mode: ReconlyMode,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isReconlyEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error("Missing query");
  }

  if (hasDirectReconlyKey()) {
    const data = await fetchReconlyDirect(mode, trimmed, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    "/api/reconly",
    { mode, query: trimmed },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Reconly lookup for UI / specialty consumers. */
export async function fetchReconlySanitized(
  query: string,
  modeHint?: string | null,
  scope?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ReconlySearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      mode: "username",
      source: "breachhub",
    };
  }

  const mode = detectReconlyMode(trimmed, modeHint, scope);
  const { data, source } = await fetchReconly(mode, trimmed, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    mode,
    source,
    raw: data,
  };
}
