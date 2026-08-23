/**
 * Shared helpers for BreachHub-mirrored specialty vendor clients.
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

export const BH_VENDOR_DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
export const BH_VENDOR_DEFAULT_BASE = "https://breachhub.org";

export type BhVendorSource = "direct" | "breachhub" | "csint" | "public";

export function sanitizeBhVendorError(message: string): string {
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

function extractAdvertisedIndexTotal(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  const metaCandidates = [record.meta, nested?.meta];

  for (const meta of metaCandidates) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;

    const total = (meta as Record<string, unknown>).total;

    if (typeof total === "number" && Number.isFinite(total) && total >= 0) {
      return total;
    }
  }

  for (const key of [
    "found_total",
    "total_entries",
    "total",
    "found",
    "breaches",
  ] as const) {
    for (const source of [record, nested]) {
      if (!source) continue;

      const value = source[key];

      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
  }

  return undefined;
}

export function rowsFromBhPayload(
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
          ![
            "success",
            "message",
            "error",
            "status",
            "ok",
            "meta",
            "code",
          ].includes(key),
      );

    if (hasUseful) {
      results = scrubIntelResults([payload]);
    }
  }

  const advertised = extractAdvertisedIndexTotal(payload);
  const rowCount = results.length;

  return {
    count: rowCount,
    results,
    ...(typeof advertised === "number" && advertised > rowCount
      ? { indexTotal: advertised }
      : {}),
  };
}

async function parseJsonResponse(
  res: Response,
  timeoutMs: number,
  started: number,
): Promise<Record<string, unknown>> {
  const remaining = Math.max(2_000, timeoutMs - (Date.now() - started));
  const text = await readResponseText(res, remaining);
  let data: Record<string, unknown> = {};

  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      !res.ok
        ? sanitizeBhVendorError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index."),
    );
  }

  if (!res.ok || data.success === false) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;

    throw new Error(sanitizeBhVendorError(msg));
  }

  return data;
}

/** Direct GET against a BreachHub-compatible base (`?key=` + query params). */
export async function directBhCompatibleGet(opts: {
  gateway: string;
  baseUrl: string;
  path: string;
  apiKey: string;
  params?: Record<string, string>;
  pathParams?: Record<string, string>;
  timeoutMs?: number;
  userAgent?: string;
}): Promise<Record<string, unknown>> {
  const timeoutMs = opts.timeoutMs ?? BH_VENDOR_DEFAULT_TIMEOUT_MS;
  let resolved = opts.path;

  if (opts.pathParams) {
    resolved = resolved.replace(/:([a-zA-Z_]+)/g, (_, key: string) => {
      const value = opts.pathParams?.[key];

      if (!value) {
        throw new Error(publicSearchError(`Missing path parameter: ${key}`));
      }

      return encodeURIComponent(value);
    });
  }

  const url = new URL(
    resolved.startsWith("http")
      ? resolved
      : `${opts.baseUrl.replace(/\/$/, "")}${resolved}`,
  );

  url.searchParams.set("key", opts.apiKey);
  for (const [key, value] of Object.entries(opts.params || {})) {
    if (value) url.searchParams.set(key, value);
  }

  const started = Date.now();

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": opts.userAgent || `AnyaInt-${opts.gateway}/1.0`,
      },
      cache: "no-store",
      timeoutMs,
    });
    const data = await parseJsonResponse(res, timeoutMs, started);

    recordProviderRequest({
      gateway: opts.gateway,
      path: resolved,
      method: "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: opts.gateway,
      path: resolved,
      method: "GET",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err instanceof Error
      ? err
      : new Error(sanitizeBhVendorError("Request failed"));
  }
}

/** Direct POST against a BreachHub-compatible base (`?key=` + JSON body). */
export async function directBhCompatiblePost(opts: {
  gateway: string;
  baseUrl: string;
  path: string;
  apiKey: string;
  body?: Record<string, string>;
  timeoutMs?: number;
  userAgent?: string;
}): Promise<Record<string, unknown>> {
  const timeoutMs = opts.timeoutMs ?? BH_VENDOR_DEFAULT_TIMEOUT_MS;
  const url = new URL(
    opts.path.startsWith("http")
      ? opts.path
      : `${opts.baseUrl.replace(/\/$/, "")}${opts.path}`,
  );

  url.searchParams.set("key", opts.apiKey);

  const started = Date.now();

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": opts.userAgent || `AnyaInt-${opts.gateway}/1.0`,
      },
      body: JSON.stringify(opts.body || {}),
      cache: "no-store",
      timeoutMs,
    });
    const data = await parseJsonResponse(res, timeoutMs, started);

    recordProviderRequest({
      gateway: opts.gateway,
      path: opts.path,
      method: "POST",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: opts.gateway,
      path: opts.path,
      method: "POST",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err instanceof Error
      ? err
      : new Error(sanitizeBhVendorError("Request failed"));
  }
}

/**
 * Prefer direct vendor key → BreachHub GET. Used by most specialty mirrors.
 */
export async function fetchBhMirroredGet(opts: {
  gateway: string;
  path: string;
  params?: Record<string, string>;
  pathParams?: Record<string, string>;
  directKey?: string;
  directBaseUrl?: string;
  enabled: boolean;
  timeoutMs?: number;
}): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!opts.enabled) {
    throw new Error(publicServiceUnavailable());
  }

  const timeoutMs = opts.timeoutMs ?? BH_VENDOR_DEFAULT_TIMEOUT_MS;

  if (opts.directKey) {
    const data = await directBhCompatibleGet({
      gateway: opts.gateway,
      baseUrl: opts.directBaseUrl || BH_VENDOR_DEFAULT_BASE,
      path: opts.path,
      apiKey: opts.directKey,
      params: opts.params,
      pathParams: opts.pathParams,
      timeoutMs,
    });

    return { data, source: "direct" };
  }

  if (!isBreachHubEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const data = await breachHubGet(
    opts.path,
    opts.params || {},
    timeoutMs,
    opts.pathParams || {},
  );

  return { data, source: "breachhub" };
}

/**
 * Prefer direct vendor key → BreachHub-compatible POST (same host when keyed).
 * When only BREACHHUB_API_KEY is set, POST goes to breachhub.org with that key.
 */
export async function fetchBhMirroredPost(opts: {
  gateway: string;
  path: string;
  body?: Record<string, string>;
  directKey?: string;
  directBaseUrl?: string;
  enabled: boolean;
  timeoutMs?: number;
}): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!opts.enabled) {
    throw new Error(publicServiceUnavailable());
  }

  const timeoutMs = opts.timeoutMs ?? BH_VENDOR_DEFAULT_TIMEOUT_MS;
  const apiKey = opts.directKey || process.env.BREACHHUB_API_KEY?.trim();
  const baseUrl =
    opts.directKey && opts.directBaseUrl
      ? opts.directBaseUrl
      : BH_VENDOR_DEFAULT_BASE;

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const data = await directBhCompatiblePost({
    gateway: opts.gateway,
    baseUrl,
    path: opts.path,
    apiKey,
    body: opts.body,
    timeoutMs,
  });

  return {
    data,
    source: opts.directKey ? "direct" : "breachhub",
  };
}
