/**
 * Inf0sec multi-module OSINT client (zero in "inf0sec").
 *
 * Upstream (in priority order):
 * 1. Direct INF0SEC_API_KEY / INFOSEC_API_KEY (+ optional INF0SEC_BASE_URL)
 *    - Native inf0sec.top: POST /api/v1/query with Bearer + { module, query }
 *    - BreachHub-compatible: GET /api/inf0sec?key=&module=&query=
 * 2. BreachHub GET /api/inf0sec (BREACHHUB_API_KEY)
 *
 * Catalog modules: leaks, ip-info, domain, username, hlr, npd, discord, cfx
 * Site path: GET /api/inf0sec
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const PHONE_DIGITS_RE = /^\+?\d{7,15}$/;
const DISCORD_SNOWFLAKE_RE = /^\d{17,20}$/;

/** BreachHub catalog + native Inf0sec modules. */
export const INF0SEC_MODULES = [
  "leaks",
  "ip-info",
  "domain",
  "username",
  "hlr",
  "npd",
  "discord",
  "cfx",
] as const;

export type Inf0secModule = (typeof INF0SEC_MODULES)[number];

export type Inf0secSearchParams = {
  module: Inf0secModule;
  query?: string;
  firstname?: string;
  lastname?: string;
};

export type Inf0secSearchResult = SanitizedBreachResponse & {
  query: string;
  module: Inf0secModule;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const MODULE_SET = new Set<string>(INF0SEC_MODULES);

const MODULE_ALIASES: Record<string, Inf0secModule> = {
  leak: "leaks",
  breach: "leaks",
  breaches: "leaks",
  ip: "ip-info",
  ipinfo: "ip-info",
  phone: "hlr",
  number: "hlr",
  name: "npd",
  "discord-id": "discord",
  fivem: "cfx",
  redm: "cfx",
};

export function isInf0secModule(value: string): value is Inf0secModule {
  return normalizeInf0secModule(value) != null;
}

export function normalizeInf0secModule(
  value: string | null | undefined,
): Inf0secModule | null {
  const raw = (value || "").trim().toLowerCase();

  if (!raw) return null;
  if (MODULE_SET.has(raw)) return raw as Inf0secModule;

  return MODULE_ALIASES[raw] ?? null;
}

export function getInf0secApiKey(): string | undefined {
  const key =
    process.env.INF0SEC_API_KEY?.trim() ||
    process.env.INFOSEC_API_KEY?.trim();

  return key || undefined;
}

export function getInf0secBaseUrl(): string {
  const base =
    process.env.INF0SEC_BASE_URL?.trim() ||
    process.env.INFOSEC_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  // Default BreachHub-compatible; set INF0SEC_BASE_URL=https://inf0sec.top for native.
  return DEFAULT_BASE;
}

/** True when a direct Inf0sec / vendor key is configured. */
export function hasDirectInf0secKey(): boolean {
  return Boolean(getInf0secApiKey());
}

export function isInf0secEnabled(): boolean {
  if (
    process.env.INF0SEC_ENABLED === "false" ||
    process.env.INFOSEC_ENABLED === "false"
  ) {
    return false;
  }

  return hasDirectInf0secKey() || isBreachHubEnabled();
}

function isNativeInf0secBase(base: string): boolean {
  return /inf0sec\.(top|net|io)|infosec\.top/i.test(base);
}

/**
 * Infer Inf0sec `module` from a free-text query when the client omits it.
 * Optional `hint` accepts module aliases or moduleSlug/scope.
 */
export function detectInf0secModule(
  query: string,
  hint?: string | null,
): Inf0secModule {
  const fromHint = normalizeInf0secModule(hint);

  if (fromHint) return fromHint;

  const trimmed = query.trim();

  if (EMAIL_RE.test(trimmed)) return "leaks";
  if (IPV4_RE.test(trimmed)) return "ip-info";
  if (DISCORD_SNOWFLAKE_RE.test(trimmed)) return "discord";
  if (PHONE_DIGITS_RE.test(trimmed.replace(/[\s().-]/g, ""))) {
    return "hlr";
  }
  if (DOMAIN_RE.test(trimmed) && trimmed.includes(".")) return "domain";

  return "leaks";
}

function sanitizeInf0secError(message: string): string {
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
          ![
            "success",
            "message",
            "error",
            "status",
            "ok",
            "credits_remaining",
          ].includes(key),
      );

    if (hasUseful) {
      results = scrubIntelResults([payload]);
    }
  }

  return { count: results.length, results };
}

function buildUpstreamParams(
  params: Inf0secSearchParams,
): Record<string, string> {
  const out: Record<string, string> = { module: params.module };

  if (params.module === "npd") {
    if (params.firstname?.trim()) {
      out.firstname = params.firstname.trim();
    }
    if (params.lastname?.trim()) {
      out.lastname = params.lastname.trim();
    }
    if (params.query?.trim()) {
      out.query = params.query.trim();
    } else {
      const combined = [params.firstname, params.lastname]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ");

      if (combined) out.query = combined;
    }

    return out;
  }

  if (params.query?.trim()) {
    out.query = params.query.trim();
  }

  return out;
}

function displayQuery(params: Inf0secSearchParams): string {
  if (params.query?.trim()) return params.query.trim();

  return [params.firstname, params.lastname]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function fetchInf0secDirect(
  params: Inf0secSearchParams,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getInf0secApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const base = getInf0secBaseUrl();
  const native = isNativeInf0secBase(base);
  const upstream = buildUpstreamParams(params);
  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "inf0sec",
      path: native ? "/api/v1/query" : "/api/inf0sec",
      method: native ? "POST" : "GET",
      ok,
      latencyMs: Date.now() - started,
      statusCode: opts?.statusCode,
      error: opts?.error,
    });
  };

  try {
    let res: Response;

    if (native) {
      const body: Record<string, string> = {
        module: upstream.module,
      };

      if (upstream.query) body.query = upstream.query;
      if (upstream.firstname) body.firstname = upstream.firstname;
      if (upstream.lastname) body.lastname = upstream.lastname;

      res = await fetchWithTimeout(`${base}/api/v1/query`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "AnyaInt-Inf0sec/1.0",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        timeoutMs,
      });
    } else {
      const url = new URL(`${base}/api/inf0sec`);

      url.searchParams.set("key", apiKey);
      for (const [key, value] of Object.entries(upstream)) {
        url.searchParams.set(key, value);
      }

      res = await fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "AnyaInt-Inf0sec/1.0",
        },
        cache: "no-store",
        timeoutMs,
      });
    }

    const remaining = Math.max(2_000, timeoutMs - (Date.now() - started));
    const text = await readResponseText(res, remaining);
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      const errMsg = !res.ok
        ? sanitizeInf0secError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeInf0secError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeInf0secError(msg);

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
 * Raw Inf0sec lookup — prefers direct key, else BreachHub proxy.
 */
export async function fetchInf0sec(
  params: Inf0secSearchParams,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isInf0secEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const upstream = buildUpstreamParams(params);
  const hasQuery =
    Boolean(upstream.query?.trim()) ||
    Boolean(upstream.firstname?.trim()) ||
    Boolean(upstream.lastname?.trim());

  if (!hasQuery) {
    throw new Error("Missing query");
  }

  if (hasDirectInf0secKey()) {
    const data = await fetchInf0secDirect(params, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet("/api/inf0sec", upstream, timeoutMs);

  return { data, source: "breachhub" };
}

/** Sanitized Inf0sec lookup for UI / specialty consumers. */
export async function fetchInf0secSanitized(
  params: {
    query?: string | null;
    module?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    typeHint?: string | null;
  },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Inf0secSearchResult> {
  const query = (params.query || "").trim();
  const firstname = (params.firstname || "").trim() || undefined;
  const lastname = (params.lastname || "").trim() || undefined;
  const display = query || [firstname, lastname].filter(Boolean).join(" ");

  const module =
    normalizeInf0secModule(params.module) ||
    detectInf0secModule(display, params.typeHint);

  if (!display && module !== "npd") {
    return {
      count: 0,
      results: [],
      query: "",
      module,
      source: "breachhub",
    };
  }

  if (module === "npd" && !display && !firstname && !lastname) {
    return {
      count: 0,
      results: [],
      query: "",
      module,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchInf0sec(
    {
      module,
      query: query || undefined,
      firstname,
      lastname,
    },
    timeoutMs,
  );
  const sanitized = toSanitized(data, display);

  return {
    ...sanitized,
    query: displayQuery({
      module,
      query: query || undefined,
      firstname,
      lastname,
    }),
    module,
    source,
    raw: data,
  };
}
