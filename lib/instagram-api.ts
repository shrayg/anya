/**
 * Instagram OSINT profile lookup — username / email / phone / numeric ID.
 *
 * Site routes:
 *   GET /api/instagram?query=
 *   GET /api/instagram/id?query=
 *
 * Upstream (in priority order):
 * 1. Direct INSTAGRAM_API_KEY (+ optional INSTAGRAM_API_BASE_URL)
 * 2. BreachHub GET /api/instagram{,/id} (BREACHHUB_API_KEY)
 *
 * Distinct from DataVoid POST /api/datavoid/instagram and from the session-cookie
 * follower export at /api/osint/instagram.
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import { normalizeInstagramUsername } from "@/lib/instagram-username";
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
const IG_ID_RE = /^\d{5,20}$/;
const PHONE_HINT_RE = /^[\d\s().+-]{7,20}$/;

export const INSTAGRAM_API_KINDS = ["profile", "id"] as const;

export type InstagramApiKind = (typeof INSTAGRAM_API_KINDS)[number];

export type InstagramApiSearchResult = SanitizedBreachResponse & {
  query: string;
  kind: InstagramApiKind;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const KIND_SET = new Set<string>(INSTAGRAM_API_KINDS);

export function isInstagramApiKind(value: string): value is InstagramApiKind {
  return KIND_SET.has(value.trim().toLowerCase());
}

export function getInstagramApiKey(): string | undefined {
  const key = process.env.INSTAGRAM_API_KEY?.trim();

  return key || undefined;
}

export function getInstagramApiBaseUrl(): string {
  const base =
    process.env.INSTAGRAM_API_BASE_URL?.trim() ||
    process.env.INSTAGRAM_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Instagram OSINT key is configured. */
export function hasDirectInstagramApiKey(): boolean {
  return Boolean(getInstagramApiKey());
}

export function isInstagramApiEnabled(): boolean {
  if (process.env.INSTAGRAM_API_ENABLED === "false") return false;

  return hasDirectInstagramApiKey() || isBreachHubEnabled();
}

export function isInstagramNumericId(value: string): boolean {
  return IG_ID_RE.test(value.trim());
}

/**
 * Normalize a profile lookup value (username / URL / email / phone).
 * Returns null when empty after cleanup.
 */
export function normalizeInstagramApiQuery(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed) return null;

  if (EMAIL_RE.test(trimmed)) return trimmed.toLowerCase();

  const digits = trimmed.replace(/[^\d+]/g, "");
  const digitOnly = trimmed.replace(/\D/g, "");

  if (
    (trimmed.startsWith("+") || PHONE_HINT_RE.test(trimmed)) &&
    digitOnly.length >= 7 &&
    digitOnly.length <= 15
  ) {
    return digits.startsWith("+") ? digits : digitOnly;
  }

  if (digitOnly.length >= 7 && digitOnly.length <= 15 && /^\+?[\d\s().-]+$/.test(trimmed)) {
    return digitOnly;
  }

  const username = normalizeInstagramUsername(trimmed);

  if (username) return username;

  // Pass through other non-empty strings (upstream may accept them).
  return trimmed;
}

/** Pull a profile lookup string from common client query param names. */
export function pickInstagramProfileQuery(
  input: Record<string, string>,
): string {
  for (const key of [
    "query",
    "username",
    "user",
    "email",
    "phone",
    "q",
  ]) {
    const value = input[key]?.trim();

    if (value) return value;
  }

  return "";
}

/** Pull a numeric Instagram user ID from common param names. */
export function pickInstagramIdQuery(input: Record<string, string>): string {
  for (const key of [
    "query",
    "id",
    "user_id",
    "userId",
    "ig_id",
    "igId",
    "pk",
    "q",
  ]) {
    const value = input[key]?.trim();

    if (value) return value;
  }

  return "";
}

function sanitizeInstagramApiError(message: string): string {
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

function upstreamPath(kind: InstagramApiKind): string {
  return kind === "id" ? "/api/instagram/id" : "/api/instagram";
}

async function fetchInstagramApiDirect(
  kind: InstagramApiKind,
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getInstagramApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const path = upstreamPath(kind);
  const url = new URL(`${getInstagramApiBaseUrl()}${path}`);

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
      gateway: "instagram-api",
      path,
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
        "User-Agent": "AnyaInt-InstagramApi/1.0",
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
        ? sanitizeInstagramApiError(`HTTP ${res.status}`)
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
      const errMsg = sanitizeInstagramApiError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeInstagramApiError(msg);

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
 * Raw Instagram OSINT GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchInstagramApi(
  kind: InstagramApiKind,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isInstagramApiEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error("Missing query");
  }

  if (kind === "id" && !isInstagramNumericId(trimmed)) {
    throw new Error("Enter a valid Instagram user ID (5–20 digits).");
  }

  if (hasDirectInstagramApiKey()) {
    const data = await fetchInstagramApiDirect(kind, trimmed, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    upstreamPath(kind),
    { query: trimmed },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Instagram OSINT lookup for UI / specialty consumers. */
export async function fetchInstagramApiSanitized(
  kind: InstagramApiKind,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<InstagramApiSearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      kind,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchInstagramApi(kind, trimmed, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    kind,
    source,
    raw: data,
  };
}
