/**
 * Snapchat OSINT client — username / profile lookups.
 *
 * Upstream (in priority order):
 * 1. Direct SNAPCHAT_API_KEY (+ optional SNAPCHAT_BASE_URL)
 * 2. BreachHub GET /api/snapchat (BREACHHUB_API_KEY)
 *
 * OpenAPI: GET /api/snapchat?query=
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
const UPSTREAM_PATH = "/api/snapchat";

export type SnapchatSearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

export function getSnapchatApiKey(): string | undefined {
  const key = process.env.SNAPCHAT_API_KEY?.trim();

  return key || undefined;
}

export function getSnapchatBaseUrl(): string {
  const base = process.env.SNAPCHAT_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Snapchat OSINT key is configured. */
export function hasDirectSnapchatKey(): boolean {
  return Boolean(getSnapchatApiKey());
}

export function isSnapchatEnabled(): boolean {
  if (process.env.SNAPCHAT_ENABLED === "false") return false;

  return hasDirectSnapchatKey() || isBreachHubEnabled();
}

/** Strip @ / snapchat.com/add URLs for username lookups. */
export function normalizeSnapchatUsername(raw: string): string {
  let value = raw.trim();

  if (!value) return "";

  value = value.replace(/^@+/, "");

  try {
    if (
      /^https?:\/\//i.test(value) ||
      /^(www\.)?snapchat\.com\//i.test(value)
    ) {
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `https://${value}`,
      );

      if (
        /snapchat\.com$/i.test(url.hostname) ||
        url.hostname === "www.snapchat.com"
      ) {
        const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        const addIdx = parts.findIndex((p) => p.toLowerCase() === "add");

        if (addIdx >= 0 && parts[addIdx + 1]) {
          return parts[addIdx + 1].replace(/^@+/, "").trim();
        }

        if (parts[0] && parts[0].toLowerCase() !== "add") {
          return parts[0].replace(/^@+/, "").trim();
        }
      }
    }
  } catch {
    // keep raw strip below
  }

  return value.replace(/^@+/, "").trim();
}

function sanitizeSnapchatError(message: string): string {
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
  if (
    lower.includes("not found") ||
    lower.includes("no result") ||
    lower.includes("404")
  ) {
    return "No results were found.";
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
      record.user != null ||
      record.profile != null ||
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

async function fetchSnapchatDirect(
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getSnapchatApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getSnapchatBaseUrl()}${UPSTREAM_PATH}`);

  url.searchParams.set("key", apiKey);
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
      gateway: "snapchat",
      path: UPSTREAM_PATH,
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
        "User-Agent": "AnyaInt-Snapchat/1.0",
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
        ? sanitizeSnapchatError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (res.status === 404) {
      logRequest(true, { statusCode: res.status });

      return {
        success: true,
        count: 0,
        results: [],
        message: "No results were found.",
      };
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeSnapchatError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeSnapchatError(msg);

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
 * Raw Snapchat GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchSnapchat(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isSnapchatEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = normalizeSnapchatUsername(query);

  if (!trimmed) {
    throw new Error("Missing query");
  }

  if (hasDirectSnapchatKey()) {
    const data = await fetchSnapchatDirect(trimmed, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    UPSTREAM_PATH,
    { query: trimmed },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Snapchat lookup for UI / specialty consumers. */
export async function fetchSnapchatSanitized(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SnapchatSearchResult> {
  const trimmed = normalizeSnapchatUsername(query);

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchSnapchat(trimmed, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    source,
    raw: data,
  };
}
