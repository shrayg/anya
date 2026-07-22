/**
 * Telegram OSINT client — username / numeric ID / phone lookups.
 *
 * Upstream (in priority order):
 * 1. Direct TELEGRAM_API_KEY (+ optional TELEGRAM_BASE_URL)
 * 2. BreachHub GET /api/telegram/{username|id|phone} (BREACHHUB_API_KEY)
 *
 * OpenAPI:
 *   GET /api/telegram/username?query=&mode=basic|full
 *   GET /api/telegram/id?query=
 *   GET /api/telegram/phone?query=
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

export const TELEGRAM_KINDS = ["username", "id", "phone"] as const;

export type TelegramKind = (typeof TELEGRAM_KINDS)[number];

export const TELEGRAM_MODES = ["basic", "full"] as const;

export type TelegramMode = (typeof TELEGRAM_MODES)[number];

export type TelegramSearchResult = SanitizedBreachResponse & {
  query: string;
  kind: TelegramKind;
  mode?: TelegramMode;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const KIND_SET = new Set<string>(TELEGRAM_KINDS);
const MODE_SET = new Set<string>(TELEGRAM_MODES);

export function isTelegramKind(value: string): value is TelegramKind {
  return KIND_SET.has(value.trim().toLowerCase());
}

export function isTelegramMode(value: string): value is TelegramMode {
  return MODE_SET.has(value.trim().toLowerCase());
}

export function getTelegramApiKey(): string | undefined {
  const key = process.env.TELEGRAM_API_KEY?.trim();

  return key || undefined;
}

export function getTelegramBaseUrl(): string {
  const base = process.env.TELEGRAM_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return DEFAULT_BASE;
}

/** True when a direct Telegram OSINT key is configured. */
export function hasDirectTelegramKey(): boolean {
  return Boolean(getTelegramApiKey());
}

export function isTelegramEnabled(): boolean {
  if (process.env.TELEGRAM_ENABLED === "false") return false;

  return hasDirectTelegramKey() || isBreachHubEnabled();
}

/** Strip @ / t.me URLs for username lookups. */
export function normalizeTelegramUsername(raw: string): string {
  let value = raw.trim();

  if (!value) return "";

  value = value.replace(/^@+/, "");

  try {
    if (/^https?:\/\//i.test(value) || /^t\.me\//i.test(value)) {
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `https://${value}`,
      );

      if (/t\.me$/i.test(url.hostname) || url.hostname === "telegram.me") {
        const part = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";

        return part.replace(/^@+/, "").trim();
      }
    }
  } catch {
    // keep raw strip below
  }

  return value.replace(/^@+/, "").trim();
}

function sanitizeTelegramError(message: string): string {
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

function upstreamPath(kind: TelegramKind): string {
  return `/api/telegram/${kind}`;
}

async function fetchTelegramDirect(
  kind: TelegramKind,
  query: string,
  mode: TelegramMode | undefined,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const apiKey = getTelegramApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const path = upstreamPath(kind);
  const url = new URL(`${getTelegramBaseUrl()}${path}`);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("query", query);

  if (kind === "username" && mode) {
    url.searchParams.set("mode", mode);
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
      gateway: "telegram",
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
        "User-Agent": "AnyaInt-Telegram/1.0",
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
        ? sanitizeTelegramError(`HTTP ${res.status}`)
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
      const errMsg = sanitizeTelegramError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        "Search failed";
      const errMsg = sanitizeTelegramError(msg);

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
 * Raw Telegram GET — prefers direct key, else BreachHub proxy.
 */
export async function fetchTelegram(
  kind: TelegramKind,
  query: string,
  mode?: TelegramMode | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isTelegramEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed =
    kind === "username" ? normalizeTelegramUsername(query) : query.trim();

  if (!trimmed) {
    throw new Error("Missing query");
  }

  const resolvedMode =
    kind === "username" && mode && isTelegramMode(mode) ? mode : undefined;

  if (hasDirectTelegramKey()) {
    const data = await fetchTelegramDirect(
      kind,
      trimmed,
      resolvedMode,
      timeoutMs,
    );

    return { data, source: "direct" };
  }

  const params: Record<string, string> = { query: trimmed };

  if (resolvedMode) params.mode = resolvedMode;

  const data = await breachHubGet(upstreamPath(kind), params, timeoutMs);

  return { data, source: "breachhub" };
}

/** Sanitized Telegram lookup for UI / specialty consumers. */
export async function fetchTelegramSanitized(
  kind: TelegramKind,
  query: string,
  modeHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TelegramSearchResult> {
  const trimmed =
    kind === "username" ? normalizeTelegramUsername(query) : query.trim();

  const mode =
    kind === "username" && modeHint && isTelegramMode(modeHint)
      ? (modeHint.trim().toLowerCase() as TelegramMode)
      : kind === "username"
        ? ("full" as const)
        : undefined;

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      kind,
      mode,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchTelegram(kind, trimmed, mode, timeoutMs);
  const sanitized = toSanitized(data, trimmed);

  return {
    ...sanitized,
    query: trimmed,
    kind,
    mode,
    source,
    raw: data,
  };
}
