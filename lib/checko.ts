/**
 * Checko (checko.ru) Russian company / EGRUL lookup client.
 *
 * Upstream (in priority order):
 * 1. Direct CHECKO_API_KEY (+ optional CHECKO_BASE_URL)
 *    - Native api.checko.ru: GET /v2/company?key=&inn|ogrn|okpo=
 *    - BreachHub-compatible: GET /api/checko?key=&inn=
 * 2. BreachHub GET /api/checko (BREACHHUB_API_KEY)
 *
 * Site path: GET /api/checko (accepts inn|ogrn|okpo|query)
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
const NATIVE_BASE = "https://api.checko.ru";

export type CheckoIdKind = "inn" | "ogrn" | "okpo";

export type CheckoSearchParams = {
  inn?: string;
  ogrn?: string;
  okpo?: string;
  /** When true, native Checko may include raw EGRUL source payload. */
  source?: boolean;
};

export type CheckoSearchResult = SanitizedBreachResponse & {
  query: string;
  idKind: CheckoIdKind;
  idValue: string;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

export function getCheckoApiKey(): string | undefined {
  const key = process.env.CHECKO_API_KEY?.trim();

  return key || undefined;
}

export function getCheckoBaseUrl(): string {
  const base = process.env.CHECKO_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  // Direct key without override → official Checko API.
  if (getCheckoApiKey()) return NATIVE_BASE;

  return DEFAULT_BASE;
}

/** True when a direct Checko key is configured. */
export function hasDirectCheckoKey(): boolean {
  return Boolean(getCheckoApiKey());
}

export function isCheckoEnabled(): boolean {
  if (process.env.CHECKO_ENABLED === "false") return false;

  return hasDirectCheckoKey() || isBreachHubEnabled();
}

function isNativeCheckoBase(base: string): boolean {
  return /checko\.ru/i.test(base);
}

/** Digits-only identifier after stripping spaces and punctuation. */
export function normalizeCheckoId(raw: string): string {
  return raw.trim().replace(/[\s()-]/g, "");
}

/**
 * Infer Checko identifier kind from a free-text query.
 * OGRN (13) / OGRNIP (15) → ogrn; INN (10|12) → inn; else okpo/inn fallback.
 */
export function detectCheckoId(
  query: string,
  hint?: string | null,
): { kind: CheckoIdKind; value: string } {
  const h = (hint || "").trim().toLowerCase();
  const value = normalizeCheckoId(query);

  if (h === "inn" || h === "ogrn" || h === "okpo") {
    return { kind: h, value: value || query.trim() };
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length === 13 || digits.length === 15) {
    return { kind: "ogrn", value: digits };
  }
  if (digits.length === 10 || digits.length === 12) {
    return { kind: "inn", value: digits };
  }
  if (digits.length === 8 || digits.length === 14) {
    return { kind: "okpo", value: digits };
  }

  // BreachHub catalog always uses `inn` — keep that as the default key name.
  return { kind: "inn", value: value || query.trim() };
}

function sanitizeCheckoError(message: string): string {
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
      record.company != null ||
      record.organization != null ||
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

  return { count: results.length, results };
}

function buildLookupParams(
  kind: CheckoIdKind,
  value: string,
  source?: boolean,
): CheckoSearchParams {
  const params: CheckoSearchParams = {};

  if (kind === "ogrn") params.ogrn = value;
  else if (kind === "okpo") params.okpo = value;
  else params.inn = value;

  if (source) params.source = true;

  return params;
}

async function fetchCheckoDirect(
  params: CheckoSearchParams,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getCheckoApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const base = getCheckoBaseUrl();
  const native = isNativeCheckoBase(base);
  const url = native
    ? new URL(`${base}/v2/company`)
    : new URL(`${base}/api/checko`);

  url.searchParams.set("key", apiKey);

  if (native) {
    if (params.ogrn) url.searchParams.set("ogrn", params.ogrn);
    else if (params.okpo) url.searchParams.set("okpo", params.okpo);
    else if (params.inn) url.searchParams.set("inn", params.inn);

    if (params.source) url.searchParams.set("source", "true");
  } else {
    // BreachHub-compatible direct key path mirrors catalog `inn=`.
    const id = params.inn || params.ogrn || params.okpo;

    if (id) url.searchParams.set("inn", id);
    if (params.ogrn) url.searchParams.set("ogrn", params.ogrn);
    if (params.okpo) url.searchParams.set("okpo", params.okpo);
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
      gateway: "checko",
      path: native ? "/v2/company" : "/api/checko",
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
        "User-Agent": "AnyaInt-Checko/1.0",
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
        ? sanitizeCheckoError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        (typeof data.meta === "object" &&
          data.meta &&
          typeof (data.meta as Record<string, unknown>).message === "string" &&
          ((data.meta as Record<string, unknown>).message as string)) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeCheckoError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeCheckoError(msg);

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
 * Raw Checko GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchChecko(
  params: CheckoSearchParams,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isCheckoEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const id = params.inn || params.ogrn || params.okpo;

  if (!id?.trim()) {
    throw new Error("Missing inn, ogrn, or okpo");
  }

  if (hasDirectCheckoKey()) {
    const data = await fetchCheckoDirect(params, timeoutMs);

    return { data, source: "direct" };
  }

  // BreachHub specialty catalog uses `inn` for the identifier slot.
  const bhParams: Record<string, string> = {
    inn: params.inn || params.ogrn || params.okpo || "",
  };

  if (params.ogrn) bhParams.ogrn = params.ogrn;
  if (params.okpo) bhParams.okpo = params.okpo;

  const data = await breachHubGet("/api/checko", bhParams, timeoutMs);

  return { data, source: "breachhub" };
}

/** Sanitized Checko lookup for UI / specialty consumers. */
export async function fetchCheckoSanitized(
  query: string,
  idHint?: string | null,
  opts?: { source?: boolean; timeoutMs?: number },
): Promise<CheckoSearchResult> {
  const trimmed = query.trim();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      idKind: "inn",
      idValue: "",
      source: "breachhub",
    };
  }

  const { kind, value } = detectCheckoId(trimmed, idHint);
  const params = buildLookupParams(kind, value, opts?.source);
  const { data, source } = await fetchChecko(params, timeoutMs);
  const sanitized = toSanitized(data, value);

  return {
    ...sanitized,
    query: trimmed,
    idKind: kind,
    idValue: value,
    source,
    raw: data,
  };
}
