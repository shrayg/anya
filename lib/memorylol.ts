/**
 * Memory.lol (X/Twitter username history) client.
 *
 * Upstream (in priority order):
 * 1. Direct MEMORY_API_KEY (+ optional MEMORY_BASE_URL) -> GET /api/memory
 * 2. BreachHub GET /api/memory (BREACHHUB_API_KEY)
 *
 * OpenAPI: GET /api/memory?username=
 * Site path: GET /api/memory (accepts username|query|id)
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 * Named memorylol to avoid colliding with app session/"memory" naming.
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

export type MemoryLolSearchResult = SanitizedBreachResponse & {
  query: string;
  username: string;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

export function getMemoryApiKey(): string | undefined {
  const key =
    process.env.MEMORY_API_KEY?.trim() ||
    process.env.MEMORYLOL_API_KEY?.trim();

  return key || undefined;
}

export function getMemoryBaseUrl(): string {
  const base =
    process.env.MEMORY_BASE_URL?.trim() ||
    process.env.MEMORYLOL_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Memory.lol / vendor key is configured. */
export function hasDirectMemoryKey(): boolean {
  return Boolean(getMemoryApiKey());
}

export function isMemoryLolEnabled(): boolean {
  if (
    process.env.MEMORY_ENABLED === "false" ||
    process.env.MEMORYLOL_ENABLED === "false"
  ) {
    return false;
  }

  return hasDirectMemoryKey() || isBreachHubEnabled();
}

/** Normalize handle / numeric id input for upstream. */
export function normalizeMemoryUsername(raw: string): string {
  let value = raw.trim();

  if (!value) return "";

  value = value.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "");
  value = value.replace(/^@+/, "");
  value = value.split(/[/?#]/)[0] ?? value;
  value = value.trim();

  return value;
}

function sanitizeMemoryError(message: string): string {
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

/**
 * Flatten native memory.lol `accounts` / `screen_names` payloads into rows
 * when BreachHub-style result arrays are absent.
 */
function memoryLolAccountsToRows(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const accounts = record.accounts;

  if (!Array.isArray(accounts) || accounts.length === 0) return [];

  const rows: unknown[] = [];

  for (const account of accounts) {
    if (!account || typeof account !== "object" || Array.isArray(account)) {
      continue;
    }

    const acct = account as Record<string, unknown>;
    const id = acct.id ?? acct.id_str;
    const screenNames =
      (acct.screen_names as Record<string, unknown> | undefined) ||
      (acct["screen-names"] as Record<string, unknown> | undefined);

    if (!screenNames || typeof screenNames !== "object") {
      rows.push({
        id,
        ...(typeof acct.id_str === "string" ? { id_str: acct.id_str } : {}),
      });
      continue;
    }

    for (const [name, dates] of Object.entries(screenNames)) {
      const dateList = Array.isArray(dates)
        ? dates.filter((d): d is string => typeof d === "string")
        : [];

      rows.push({
        username: name,
        id,
        ...(typeof acct.id_str === "string" ? { id_str: acct.id_str } : {}),
        first_seen: dateList[0] ?? null,
        last_seen:
          dateList.length > 1
            ? dateList[dateList.length - 1]
            : (dateList[0] ?? null),
        dates: dateList.length > 0 ? dateList : null,
      });
    }
  }

  return rows;
}

function toSanitized(
  payload: unknown,
  query: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (results.length === 0) {
    results = scrubIntelResults(memoryLolAccountsToRows(payload));
  }

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
      record.accounts != null ||
      Object.keys(record).some(
        (key) =>
          ![
            "success",
            "message",
            "error",
            "status",
            "ok",
            "found",
            "took_ms",
            "query",
          ].includes(key),
      );

    if (hasUseful) {
      results = scrubIntelResults([payload]);
    }
  }

  return { count: results.length, results };
}

async function fetchMemoryDirect(
  username: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getMemoryApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getMemoryBaseUrl()}/api/memory`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("username", username);

  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "memorylol",
      path: "/api/memory",
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
        "User-Agent": "AnyaInt-MemoryLol/1.0",
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
        ? sanitizeMemoryError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeMemoryError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeMemoryError(msg);

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
 * Raw Memory.lol GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchMemoryLol(
  username: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isMemoryLolEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = normalizeMemoryUsername(username);

  if (!trimmed) {
    throw new Error("Missing username");
  }

  if (hasDirectMemoryKey()) {
    const data = await fetchMemoryDirect(trimmed, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    "/api/memory",
    { username: trimmed },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Memory.lol lookup for UI / specialty consumers. */
export async function fetchMemoryLolSanitized(
  username: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MemoryLolSearchResult> {
  const trimmed = normalizeMemoryUsername(username);

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      username: trimmed,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchMemoryLol(trimmed, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    username: trimmed,
    source,
    raw: data,
  };
}
