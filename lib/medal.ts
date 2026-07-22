/**
 * Medal.tv profile / clip lookup client.
 *
 * Upstream (in priority order):
 * 1. Direct MEDAL_API_KEY (+ optional MEDAL_BASE_URL)
 * 2. BreachHub GET /api/medal (BREACHHUB_API_KEY)
 *
 * BreachHub: GET /api/medal?username=&type=username
 * Site path: GET /api/medal (accepts username|query|id)
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

export const MEDAL_TYPES = ["username"] as const;

export type MedalType = (typeof MEDAL_TYPES)[number];

export type MedalSearchResult = SanitizedBreachResponse & {
  query: string;
  username: string;
  type: MedalType;
  source: "direct" | "breachhub";
  profile?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

const TYPE_SET = new Set<string>(MEDAL_TYPES);

export function isMedalType(value: string): value is MedalType {
  return TYPE_SET.has(value.trim().toLowerCase());
}

export function getMedalApiKey(): string | undefined {
  const key =
    process.env.MEDAL_API_KEY?.trim() || process.env.MEDALTV_API_KEY?.trim();

  return key || undefined;
}

export function getMedalBaseUrl(): string {
  const base =
    process.env.MEDAL_BASE_URL?.trim() ||
    process.env.MEDALTV_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Medal / vendor key is configured. */
export function hasDirectMedalKey(): boolean {
  return Boolean(getMedalApiKey());
}

export function isMedalEnabled(): boolean {
  if (
    process.env.MEDAL_ENABLED === "false" ||
    process.env.MEDALTV_ENABLED === "false"
  ) {
    return false;
  }

  return hasDirectMedalKey() || isBreachHubEnabled();
}

/**
 * Normalize Medal handle / profile URL input for upstream.
 * Strips @, medal.tv/u/… and medal.tv/users/… paths.
 */
export function normalizeMedalUsername(raw: string): string {
  let value = raw.trim();

  if (!value) return "";

  value = value.replace(/^@+/, "");

  try {
    if (/^https?:\/\//i.test(value) || /^medal\.tv\//i.test(value)) {
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `https://${value}`,
      );

      if (/medal\.tv$/i.test(url.hostname)) {
        const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        const uIdx = parts.findIndex((p) => p.toLowerCase() === "u");
        const usersIdx = parts.findIndex((p) => p.toLowerCase() === "users");

        if (uIdx >= 0 && parts[uIdx + 1]) {
          return parts[uIdx + 1].replace(/^@+/, "").trim();
        }
        if (usersIdx >= 0 && parts[usersIdx + 1]) {
          return parts[usersIdx + 1].replace(/^@+/, "").trim();
        }
      }
    }
  } catch {
    // keep strip below
  }

  value = value.split(/[/?#]/)[0] ?? value;

  return value.replace(/^@+/, "").trim();
}

export function detectMedalType(
  _query: string,
  hint?: string | null,
): MedalType {
  const h = (hint || "").trim().toLowerCase();

  if (isMedalType(h)) return h;

  return "username";
}

function sanitizeMedalError(message: string): string {
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

function profileFromPayload(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const profile = record.profile;

  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    return profile as Record<string, unknown>;
  }

  return undefined;
}

function toSanitized(
  payload: unknown,
  query: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (results.length === 0) {
    const profile = profileFromPayload(payload);

    if (profile) {
      results = scrubIntelResults([profile]);
    }
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
      record.profile != null ||
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
            "credit",
            "service",
          ].includes(key),
      );

    if (hasUseful) {
      results = scrubIntelResults([payload]);
    }
  }

  return { count: results.length, results };
}

async function fetchMedalDirect(
  username: string,
  type: MedalType,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getMedalApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${getMedalBaseUrl()}/api/medal`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("username", username);
  url.searchParams.set("type", type);

  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    opts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "medal",
      path: "/api/medal",
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
        "User-Agent": "AnyaInt-Medal/1.0",
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
        ? sanitizeMedalError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizeMedalError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeMedalError(msg);

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
 * Raw Medal GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchMedal(
  username: string,
  type: MedalType = "username",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isMedalEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = normalizeMedalUsername(username);

  if (!trimmed) {
    throw new Error("Missing username");
  }

  if (hasDirectMedalKey()) {
    const data = await fetchMedalDirect(trimmed, type, timeoutMs);

    return { data, source: "direct" };
  }

  const data = await breachHubGet(
    "/api/medal",
    { username: trimmed, type },
    timeoutMs,
  );

  return { data, source: "breachhub" };
}

/** Sanitized Medal lookup for UI / specialty consumers. */
export async function fetchMedalSanitized(
  username: string,
  typeHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MedalSearchResult> {
  const trimmed = normalizeMedalUsername(username);

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      username: trimmed,
      type: "username",
      source: "breachhub",
    };
  }

  const type = detectMedalType(trimmed, typeHint);
  const { data, source } = await fetchMedal(trimmed, type, timeoutMs);
  const sanitized = toSanitized(data, trimmed);
  const profile = profileFromPayload(data);

  return {
    ...sanitized,
    query: trimmed,
    username: trimmed,
    type,
    source,
    ...(profile ? { profile } : {}),
    raw: data,
  };
}
