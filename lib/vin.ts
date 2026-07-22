/**
 * VIN (vehicle identification number) lookup client.
 *
 * Decode (always available unless VIN_ENABLED=false):
 *   NHTSA vPIC DecodeVinValues — no API key required
 *
 * Optional index enrichment (in priority order):
 * 1. Direct VIN_API_KEY (+ optional VIN_BASE_URL) → GET /api/vin
 * 2. BreachHub specialty (vin / intelbase-vin / intelbase-bmw)
 *
 * OpenAPI (BreachHub-compatible): GET /api/vin?type=vin&query=
 * Site path: GET /api/vin (accepts vin|query)
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 * Types for the UI live in lib/vin-decode.ts (safe to import client-side).
 */

import {
  breachHubGet,
  extractBreachHubRows,
  fetchBreachHubSpecialty,
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
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { recordProviderRequest } from "@/lib/provider-request-log";
import {
  decodeVin,
  normalizeVin,
  type VinDecodeResult,
} from "@/lib/vin-decode";

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const DEFAULT_BASE = "https://breachhub.org";

export type VinLookupResult = VinDecodeResult & {
  indexHits?: SanitizedBreachResponse;
  sources?: string[];
  decodeSource: "nhtsa";
  indexSource?: "direct" | "breachhub";
};

export function getVinApiKey(): string | undefined {
  const key = process.env.VIN_API_KEY?.trim();

  return key || undefined;
}

export function getVinBaseUrl(): string {
  const base = process.env.VIN_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct VIN specialty key is configured. */
export function hasDirectVinKey(): boolean {
  return Boolean(getVinApiKey());
}

/**
 * VIN decode is on by default (NHTSA needs no key).
 * Set VIN_ENABLED=false to disable without removing other keys.
 */
export function isVinEnabled(): boolean {
  if (process.env.VIN_ENABLED === "false") return false;

  return true;
}

function sanitizeVinError(message: string): string {
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

async function fetchVinIndexDirect(
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getVinApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getVinBaseUrl()}/api/vin`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("type", "vin");
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
      gateway: "vin",
      path: "/api/vin",
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
        "User-Agent": "AnyaInt-VIN/1.0",
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
        ? sanitizeVinError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeVinError(msg);

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
 * Optional specialty / index lookup — prefers direct VIN key, else BreachHub.
 * Returns null when neither is configured or the lookup yields nothing.
 */
export async function fetchVinIndex(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{
  hits: SanitizedBreachResponse;
  source: "direct" | "breachhub";
} | null> {
  const trimmed = query.trim();

  if (!trimmed) return null;

  if (hasDirectVinKey()) {
    try {
      const data = await fetchVinIndexDirect(trimmed, timeoutMs);
      const sanitized = toSanitized(data, trimmed);

      if (sanitized.count > 0) {
        return { hits: sanitized, source: "direct" };
      }
    } catch {
      // Fall through to BreachHub specialty when direct fails/empty.
    }
  }

  if (!isBreachHubEnabled()) return null;

  try {
    const specialty = await fetchBreachHubSpecialty("vin", trimmed, timeoutMs);

    if (specialty && specialty.count > 0) {
      return { hits: specialty, source: "breachhub" };
    }
  } catch {
    try {
      const data = await breachHubGet(
        "/api/vin",
        { type: "vin", query: trimmed },
        timeoutMs,
      );
      const sanitized = toSanitized(data, trimmed);

      if (sanitized.count > 0) {
        return { hits: sanitized, source: "breachhub" };
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Full VIN lookup for UI / API consumers: NHTSA decode + optional index hits.
 */
export async function lookupVin(
  input: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<VinLookupResult> {
  if (!isVinEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const normalized = normalizeVin(input);

  if (!normalized) {
    throw new Error("Enter a valid 11–17 character VIN.");
  }

  const [decoded, index] = await Promise.all([
    decodeVin(normalized),
    fetchVinIndex(normalized, timeoutMs).catch(() => null),
  ]);

  return {
    ...decoded,
    decodeSource: "nhtsa",
    ...(index && index.hits.count > 0
      ? {
          indexHits: index.hits,
          indexSource: index.source,
          sources: [PUBLIC_INTEL_SOURCE],
        }
      : {}),
  };
}

export { normalizeVin, decodeVin };
export type { VinDecodeResult };
