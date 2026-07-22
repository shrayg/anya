/**
 * Melissa contact-enrichment client — email / phone / IP / free-form input.
 *
 * Upstream (in priority order):
 * 1. Direct MELISSA_API_KEY (+ optional MELISSA_BASE_URL)
 * 2. BreachHub GET /api/melissa (BREACHHUB_API_KEY)
 * 3. CSINT POST /melissa/lookup (CSINT_API_KEY)
 *
 * OpenAPI-style: GET /api/melissa?input=… (also accepts query / email / phone / …)
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import { fetchCsintMelissaLookup, isCsintEnabled } from "@/lib/csint";
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

/** Structured / free-form fields accepted by Melissa / BreachHub / CSINT. */
export const MELISSA_PARAM_KEYS = [
  "input",
  "query",
  "email",
  "phone",
  "ip",
  "first",
  "last",
  "a1",
  "a2",
  "city",
  "state",
  "postal",
  "comp",
] as const;

export type MelissaParamKey = (typeof MELISSA_PARAM_KEYS)[number];

export type MelissaLookupBody = Partial<Record<MelissaParamKey, string>>;

export type MelissaSearchResult = SanitizedBreachResponse & {
  query: string;
  source: "direct" | "breachhub" | "csint";
  raw?: Record<string, unknown>;
};

export function getMelissaApiKey(): string | undefined {
  const key = process.env.MELISSA_API_KEY?.trim();

  return key || undefined;
}

export function getMelissaBaseUrl(): string {
  const base = process.env.MELISSA_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Melissa / BreachHub-compat key is configured. */
export function hasDirectMelissaKey(): boolean {
  return Boolean(getMelissaApiKey());
}

export function isMelissaEnabled(): boolean {
  if (process.env.MELISSA_ENABLED === "false") return false;

  return hasDirectMelissaKey() || isBreachHubEnabled() || isCsintEnabled();
}

/**
 * Build upstream params from free-form + structured fields.
 * BreachHub specialty catalog uses `input`; CSINT accepts structured keys.
 */
export function buildMelissaParams(
  body: MelissaLookupBody,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const key of MELISSA_PARAM_KEYS) {
    if (key === "query") continue;
    const value = body[key]?.trim();

    if (value) params[key] = value;
  }

  const free =
    body.input?.trim() ||
    body.query?.trim() ||
    body.email?.trim() ||
    body.phone?.trim() ||
    body.ip?.trim() ||
    [body.first, body.last].filter(Boolean).join(" ").trim() ||
    "";

  if (free && !params.input && !params.email && !params.phone && !params.ip) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(free)) {
      params.email = free;
    } else if (
      /^[\d\s+\-().]+$/.test(free) &&
      free.replace(/\D/g, "").length >= 10
    ) {
      params.phone = free;
    } else {
      params.input = free;
    }
  } else if (free && !params.input) {
    params.input = free;
  }

  return params;
}

export function melissaQueryLabel(params: Record<string, string>): string {
  return (
    params.input ||
    params.email ||
    params.phone ||
    params.ip ||
    [params.first, params.last].filter(Boolean).join(" ") ||
    Object.values(params).join(" ")
  ).trim();
}

function sanitizeMelissaError(message: string): string {
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

function hasUsefulPayload(data: Record<string, unknown> | null): boolean {
  if (!data || typeof data !== "object") return false;

  if (typeof data.count === "number") return data.count > 0;

  return Object.keys(data).length > 0;
}

async function fetchMelissaDirect(
  params: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getMelissaApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getMelissaBaseUrl()}/api/melissa`);

  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
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
      gateway: "melissa",
      path: "/api/melissa",
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
        "User-Agent": "AnyaInt-Melissa/1.0",
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
        ? sanitizeMelissaError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeMelissaError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeMelissaError(msg);

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
 * Raw Melissa lookup — prefers direct key, else BreachHub, else CSINT.
 */
export async function fetchMelissa(
  body: MelissaLookupBody,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{
  data: Record<string, unknown>;
  source: "direct" | "breachhub" | "csint";
}> {
  if (!isMelissaEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const params = buildMelissaParams(body);

  if (Object.keys(params).length === 0) {
    throw new Error("Missing query");
  }

  if (hasDirectMelissaKey()) {
    const data = await fetchMelissaDirect(params, timeoutMs);

    if (hasUsefulPayload(data)) {
      return { data, source: "direct" };
    }
  }

  if (isBreachHubEnabled()) {
    try {
      const data = await breachHubGet("/api/melissa", params, timeoutMs);

      if (hasUsefulPayload(data)) {
        return { data, source: "breachhub" };
      }
    } catch {
      // Fall through to CSINT.
    }
  }

  if (isCsintEnabled()) {
    const data = await fetchCsintMelissaLookup(params);

    return { data, source: "csint" };
  }

  if (hasDirectMelissaKey()) {
    const data = await fetchMelissaDirect(params, timeoutMs);

    return { data, source: "direct" };
  }

  throw new Error(publicServiceUnavailable());
}

/** Sanitized Melissa lookup for UI / specialty consumers. */
export async function fetchMelissaSanitized(
  body: MelissaLookupBody,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MelissaSearchResult> {
  const params = buildMelissaParams(body);
  const query = melissaQueryLabel(params);

  if (!query && Object.keys(params).length === 0) {
    return {
      count: 0,
      results: [],
      query: "",
      source: "breachhub",
    };
  }

  const { data, source } = await fetchMelissa(body, timeoutMs);
  const sanitized = toSanitized(data, query);

  return {
    ...sanitized,
    query,
    source,
    raw: data,
  };
}
