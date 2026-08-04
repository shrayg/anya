/**
 * csint.pro intelligence client.
 * Key via CSINT_API_KEY. Set CSINT_ENABLED=false to disable without removing the key.
 */

import type { SanitizedBreachResponse } from "@/lib/osintcat";
import {
  connectedFieldsFromBreachRecord,
  type CombCredential,
} from "@/lib/proxynova-comb";

import {
  intelResultFingerprint,
  isBrandPlaceholderValue,
  isIdentityFieldKey,
  isInternalSourceLabel,
  scrubIntelRecord,
} from "@/lib/intel-record";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import {
  DEFAULT_INTELX_BUCKET,
  isIntelxBucket,
  type IntelxBucket,
} from "@/lib/intelx-buckets";
import {
  OSINT_PROVIDER_TIMEOUT_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { recordProviderRequest } from "@/lib/provider-request-log";

const CSINT_BASE = "https://csint.pro/api";
const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const SHODAN_TIMEOUT_MS = 18_000;
/** Memory-safety ceiling only — return full hit sets up to this. */
const MAX_ROWS = 250_000;
const MAX_SHODAN_SERVICES = 48;
const MAX_SHODAN_BANNER_CHARS = 1_500;

export type CsintSearchType = "email" | "phone" | "username" | "ip" | "auto";

export function getCsintApiKey(): string | undefined {
  const key = process.env.CSINT_API_KEY?.trim();

  return key || undefined;
}

export function isCsintEnabled(): boolean {
  if (process.env.CSINT_ENABLED === "false") return false;

  return Boolean(getCsintApiKey());
}

function sanitizeCsintError(message: string): string {
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
    lower.includes("429") ||
    lower.includes("rate limit abuse") ||
    lower.includes("temporarily blocked")
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }
  if (
    lower.includes("cloudflare") ||
    lower.includes("cf-ray") ||
    lower.includes("attention required")
  ) {
    return "Provider temporarily blocked this request. Try again later.";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid api") ||
    lower.includes("invalid response") ||
    lower.includes("invalid json") ||
    /\b502\b/.test(lower) ||
    /\b503\b/.test(lower)
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

/** Soft-fail stub — quota/CF-blocked providers must not be hammered. */
export const CSINT_QUOTA_BLOCKED_MESSAGE =
  "This intelligence source is temporarily unavailable due to provider limits.";

export async function fetchCsintQuotaBlockedStub(
  _label?: string,
): Promise<null> {
  return null;
}

/**
 * csint.pro documents max ~3 req/s and abuse-blocks keys/IPs for ~30 minutes.
 * Serialize in-flight POSTs (one at a time) and pad ~2 req/s so Breaches
 * additive fan-out and Discord lookups share one process-wide budget.
 */
const CSINT_MIN_INTERVAL_MS = 500;
const CSINT_DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;
const CSINT_MAX_COOLDOWN_MS = 35 * 60 * 1000;
let csintGate: Promise<unknown> = Promise.resolve();
let csintNextAt = 0;
let csintBlockedUntil = 0;

function csintRateLimitMessage(): string {
  return sanitizeCsintError("rate limit abuse temporarily blocked");
}

function readCsintRetryMs(data: Record<string, unknown>): number | null {
  const raw =
    data.retry_after_seconds ??
    data.retry_after ??
    data.retryAfterSeconds ??
    data.retryAfter;

  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;

  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.min(Math.ceil(n * 1000), CSINT_MAX_COOLDOWN_MS);
}

/** True when CSINT returned an abuse / rate-limit envelope (even on HTTP 200). */
export function isCsintRateLimitPayload(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;

  const blob = [
    data.reason,
    data.message,
    data.error,
    data.details,
    data.status,
  ]
    .map((v) => (typeof v === "string" ? v : ""))
    .join(" ")
    .toLowerCase();

  if (
    blob.includes("rate limit") ||
    blob.includes("rate_limit") ||
    blob.includes("too many requests") ||
    blob.includes("abuse") ||
    blob.includes("temporarily blocked") ||
    /\b429\b/.test(blob)
  ) {
    return true;
  }

  if (
    data.data_found === false &&
    readCsintRetryMs(data) != null &&
    (typeof data.reason === "string" || typeof data.message === "string")
  ) {
    return true;
  }

  return false;
}

function noteCsintCooldown(data?: Record<string, unknown>, statusCode?: number) {
  const fromBody = data ? readCsintRetryMs(data) : null;
  const waitMs =
    fromBody ??
    (statusCode === 429 ? CSINT_DEFAULT_COOLDOWN_MS : null) ??
    (data && isCsintRateLimitPayload(data) ? CSINT_DEFAULT_COOLDOWN_MS : null);

  if (waitMs == null) return;

  csintBlockedUntil = Math.max(csintBlockedUntil, Date.now() + waitMs);
}

export function isCsintCoolingDown(): boolean {
  return Date.now() < csintBlockedUntil;
}

export function csintCooldownRemainingMs(): number {
  return Math.max(0, csintBlockedUntil - Date.now());
}

async function withCsintSlot<T>(fn: () => Promise<T>): Promise<T> {
  const run = csintGate.then(async () => {
    // Fail fast while abuse-blocked — never sleep out a 30-minute cooldown.
    if (Date.now() < csintBlockedUntil) {
      throw new Error(csintRateLimitMessage());
    }

    const wait = Math.max(0, csintNextAt - Date.now());

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    if (Date.now() < csintBlockedUntil) {
      throw new Error(csintRateLimitMessage());
    }

    try {
      return await fn();
    } finally {
      // Space the *next* start after this request finishes — not while in flight.
      csintNextAt = Date.now() + CSINT_MIN_INTERVAL_MS;
    }
  });

  // Keep the chain alive even if a waiter fails.
  csintGate = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function csintPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const apiKey = getCsintApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  return withCsintSlot(async () => {
    const started = Date.now();
    let logged = false;

    const logRequest = (
      ok: boolean,
      opts?: { statusCode?: number; error?: string },
    ) => {
      if (logged) return;
      logged = true;
      recordProviderRequest({
        gateway: "csint",
        path,
        method: "POST",
        ok,
        latencyMs: Date.now() - started,
        statusCode: opts?.statusCode,
        error: opts?.error,
      });
    };

    try {
      const res = await fetchWithTimeout(`${CSINT_BASE}${path}`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
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
          ? sanitizeCsintError(`HTTP ${res.status}`)
          : publicSearchError("Invalid response from intelligence index.");

        if (res.status === 429) noteCsintCooldown(undefined, 429);
        logRequest(false, { statusCode: res.status, error: errMsg });
        throw new Error(errMsg);
      }

      if (isCsintRateLimitPayload(data) || res.status === 429) {
        noteCsintCooldown(data, res.status);
        const msg =
          (typeof data.message === "string" && data.message) ||
          (typeof data.reason === "string" && data.reason) ||
          (typeof data.error === "string" && data.error) ||
          `HTTP ${res.status}`;
        const errMsg = sanitizeCsintError(msg);

        logRequest(false, { statusCode: res.status, error: errMsg });
        throw new Error(errMsg);
      }

      if (!res.ok) {
        const msg =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          `HTTP ${res.status}`;
        const errMsg = sanitizeCsintError(msg);

        logRequest(false, { statusCode: res.status, error: errMsg });
        throw new Error(errMsg);
      }

      if (data.success === false) {
        const msg =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          publicSearchError();
        const errMsg = sanitizeCsintError(msg);

        if (isCsintRateLimitPayload(data) || /rate|429|blocked|abuse/i.test(msg)) {
          noteCsintCooldown(data, res.status);
        }

        logRequest(false, { statusCode: res.status, error: errMsg });
        throw new Error(errMsg);
      }

      logRequest(true, { statusCode: res.status });

      return sanitizeCsintPayload(data);
    } catch (err) {
      logRequest(false, {
        error: err instanceof Error ? err.message : "Request failed",
      });
      throw err;
    }
  });
}

function truncateBanner(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = sanitizePublicText(value);

  if (!cleaned) return null;
  if (cleaned.length <= MAX_SHODAN_BANNER_CHARS) return cleaned;

  return `${cleaned.slice(0, MAX_SHODAN_BANNER_CHARS)}…`;
}

/** Keep Shodan host payloads small — full banners can OOM/crash the route → opaque 502. */
export function compactShodanHostPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const root =
    data.data && typeof data.data === "object" && !Array.isArray(data.data)
      ? (data.data as Record<string, unknown>)
      : data;

  const ports = new Set<number>();

  if (Array.isArray(root.ports)) {
    for (const p of root.ports) {
      if (typeof p === "number" && Number.isFinite(p)) ports.add(p);
    }
  }

  const services: Record<string, unknown>[] = [];
  const serviceRows = Array.isArray(root.data) ? root.data : [];

  for (const row of serviceRows.slice(0, MAX_SHODAN_SERVICES)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const svc = row as Record<string, unknown>;
    const port = typeof svc.port === "number" ? svc.port : null;

    if (port != null) ports.add(port);

    const banner =
      truncateBanner(svc.data) ??
      truncateBanner(svc.banner) ??
      truncateBanner(svc.raw);

    services.push({
      ...(port != null ? { port } : {}),
      ...(typeof svc.transport === "string"
        ? { transport: svc.transport }
        : {}),
      ...(typeof svc.product === "string"
        ? { product: sanitizePublicText(svc.product) }
        : {}),
      ...(typeof svc.version === "string"
        ? { version: sanitizePublicText(svc.version) }
        : {}),
      ...(typeof svc.module === "string"
        ? { module: sanitizePublicText(svc.module) }
        : {}),
      ...(banner ? { banner } : {}),
    });
  }

  const hostnames = Array.isArray(root.hostnames)
    ? root.hostnames
        .filter((h): h is string => typeof h === "string")
        .map((h) => sanitizePublicText(h))
        .filter(Boolean)
        .slice(0, 40)
    : [];

  let vulns: string[] = [];

  if (Array.isArray(root.vulns)) {
    vulns = root.vulns.map(String).slice(0, 40);
  } else if (root.vulns && typeof root.vulns === "object") {
    vulns = Object.keys(root.vulns as Record<string, unknown>).slice(0, 40);
  }

  const org =
    (typeof root.org === "string" && sanitizePublicText(root.org)) ||
    (typeof root.isp === "string" && sanitizePublicText(root.isp)) ||
    null;

  return {
    ip:
      (typeof root.ip_str === "string" && root.ip_str) ||
      (typeof root.ip === "string" && root.ip) ||
      (typeof data.ip === "string" && data.ip) ||
      null,
    ports: [...ports].sort((a, b) => a - b),
    org,
    isp: typeof root.isp === "string" ? sanitizePublicText(root.isp) : null,
    asn: typeof root.asn === "string" ? sanitizePublicText(root.asn) : null,
    hostnames,
    vulns,
    country:
      (typeof root.country_name === "string" &&
        sanitizePublicText(root.country_name)) ||
      (typeof root.country_code === "string" && root.country_code) ||
      null,
    city: typeof root.city === "string" ? sanitizePublicText(root.city) : null,
    last_update: typeof root.last_update === "string" ? root.last_update : null,
    services,
  };
}

function sanitizeCsintStringField(key: string, value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  // Never rewrite identity/secret fields to the product brand — that produced
  // fake Snapchat "credentials" like username/password/raw = "Anya.Int".
  if (isIdentityFieldKey(key)) {
    if (isBrandPlaceholderValue(trimmed)) return null;

    return trimmed;
  }

  if (
    /^(source|sources|_source|provider|providers|service|credit|credits)$/i.test(
      key,
    )
  ) {
    return null;
  }

  const cleaned = sanitizePublicText(trimmed);

  if (!cleaned || isBrandPlaceholderValue(cleaned)) return null;

  return cleaned;
}

function sanitizeCsintPayload(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (
      key === "credits" ||
      key === "credit" ||
      key === "service" ||
      key === "source" ||
      key === "sources" ||
      key === "_source" ||
      key === "provider" ||
      key === "providers" ||
      key === "powered_by" ||
      key === "poweredBy" ||
      /csint|godseye|osintcat|snusbase|breachvip|breachbase|oathnet|shodan|intelx|cordcat|seon|hackcheck|leakcheck|melissa/i.test(
        key,
      )
    ) {
      continue;
    }

    if (typeof raw === "string") {
      const cleaned = sanitizeCsintStringField(key, raw);

      if (cleaned !== null) out[key] = cleaned;
    } else if (Array.isArray(raw)) {
      out[key] = raw.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? sanitizeCsintPayload(item as Record<string, unknown>)
          : typeof item === "string"
            ? sanitizePublicText(item)
            : item,
      );
    } else if (raw && typeof raw === "object") {
      out[key] = sanitizeCsintPayload(raw as Record<string, unknown>);
    } else {
      out[key] = raw;
    }
  }

  return out;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // Never coerce objects — String({}) becomes "[object Object]".
  return "";
}

const META_KEYS = new Set([
  "success",
  "credits",
  "credit",
  "service",
  "source",
  "query",
  "type",
  "message",
  "error",
  "errors",
  "status",
  "took",
  "time",
  "elapsed",
  "count",
  "total",
  "size",
  "data_found",
  "reason",
  "retry_after",
  "retry_after_seconds",
  "retryAfter",
  "retryAfterSeconds",
]);

function pushBreachMapEntry(
  breachName: string,
  value: unknown,
  out: Record<string, unknown>[],
) {
  const dbLabel =
    breachName.trim() &&
    !isInternalSourceLabel(breachName) &&
    !META_KEYS.has(breachName)
      ? breachName.trim()
      : undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed || isBrandPlaceholderValue(trimmed)) return;

    const [left, ...rest] = trimmed.split(":");
    const secret = rest.length > 0 ? rest.join(":").trim() : "";
    const login = (left ?? "").trim();

    // Colon-less strings are identifiers only — never invent a password from them.
    const email = login.includes("@") ? login : undefined;
    const username = login && !login.includes("@") ? login : undefined;

    if (
      (email && isBrandPlaceholderValue(email)) ||
      (username && isBrandPlaceholderValue(username)) ||
      (secret && isBrandPlaceholderValue(secret))
    ) {
      return;
    }

    if (!email && !username && !secret) return;

    const row: Record<string, unknown> = {
      ...(dbLabel ? { database: dbLabel } : {}),
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
      ...(secret ? { password: secret } : {}),
      raw: trimmed,
    };

    const scrubbed = scrubIntelRecord(row);

    if (scrubbed) out.push(scrubbed);

    return;
  }

  if (Array.isArray(value)) {
    collectRows(value, out);

    return;
  }

  if (value && typeof value === "object") {
    const row = {
      ...(value as Record<string, unknown>),
      ...(dbLabel ? { database: dbLabel } : {}),
    };
    const scrubbed = scrubIntelRecord(row);

    if (scrubbed) out.push(scrubbed);

    return;
  }

  // Empty / null map values are not hits.
}

function looksLikeBreachMap(record: Record<string, unknown>): boolean {
  const entries = Object.entries(record).filter(([key]) => !META_KEYS.has(key));

  if (entries.length === 0) return false;

  return entries.every(([, value]) => {
    if (value == null || value === "") return true;
    if (typeof value === "string") return true;
    if (Array.isArray(value)) return true;
    if (typeof value === "object") {
      const nested = value as Record<string, unknown>;

      return Boolean(
        asString(nested.email) ||
          asString(nested.username) ||
          asString(nested.password) ||
          asString(nested.hash) ||
          asString(nested.ip) ||
          asString(nested.phone),
      );
    }

    return false;
  });
}

function collectRows(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, out);

    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  // Never promote rate-limit / abuse envelopes into breach cards.
  if (isCsintRateLimitPayload(record)) return;

  // Nested source wrappers from unified search (snusbase/breachvip/etc.)
  if (record.data && typeof record.data === "object") {
    collectRows(record.data, out);
    if (
      record.success === true ||
      record.success === false ||
      typeof record.service === "string"
    ) {
      return;
    }
  }

  for (const key of [
    "results",
    "result",
    "records",
    "entries",
    "items",
    "leaks",
    "breach_data",
    "rows",
    "hits",
    "found",
  ]) {
    const nested = record[key];

    if (Array.isArray(nested)) {
      collectRows(nested, out);

      return;
    }
    // Snusbase-style map: { "BREACH_NAME": "email:pass" | "" | object }
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [breachName, value] of Object.entries(
        nested as Record<string, unknown>,
      )) {
        pushBreachMapEntry(breachName, value, out);
      }

      return;
    }
  }

  // Unkeyed breach map at this level (common in nested snusbase payloads)
  if (
    looksLikeBreachMap(record) &&
    !asString(record.email) &&
    !asString(record.username)
  ) {
    for (const [breachName, value] of Object.entries(record)) {
      if (META_KEYS.has(breachName)) continue;
      pushBreachMapEntry(breachName, value, out);
    }

    return;
  }

  // Leaf-ish record with identifiable fields
  if (
    asString(record.email) ||
    asString(record.username) ||
    asString(record.password) ||
    asString(record.ip) ||
    asString(record.phone) ||
    asString(record.hash) ||
    asString(record.name) ||
    asString(record.ip_address) ||
    asString(record.discord_id) ||
    asString(record.roblox_id) ||
    asString(record.user_id)
  ) {
    const scrubbed = scrubIntelRecord(record);

    if (scrubbed) out.push(scrubbed);
  }
}

/** Drop paywalled preview rows whose values are mostly ***UPGRADE_TO_SEE***. */
function isUpgradeToSeePlaceholder(row: Record<string, unknown>): boolean {
  const values = Object.values(row).filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  if (values.length === 0) return false;
  const placeholders = values.filter((v) => /UPGRADE_TO_SEE/i.test(v));

  return placeholders.length >= Math.ceil(values.length / 2);
}

function payloadToSanitized(
  payload: Record<string, unknown>,
): SanitizedBreachResponse {
  const results: Record<string, unknown>[] = [];

  collectRows(payload, results);

  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];

  for (const row of results) {
    if (isUpgradeToSeePlaceholder(row)) continue;
    const scrubbed = scrubIntelRecord(row);

    if (!scrubbed) continue;
    const key = intelResultFingerprint(scrubbed);

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(scrubbed);
    if (deduped.length >= MAX_ROWS) break;
  }

  return { count: deduped.length, results: deduped };
}

function mergeOptionalSanitized(
  ...parts: Array<SanitizedBreachResponse | null | undefined>
): SanitizedBreachResponse | null {
  const merged: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!part?.results?.length) continue;
    for (const row of part.results) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;

      if (isUpgradeToSeePlaceholder(record)) continue;
      const scrubbed = scrubIntelRecord(record);

      if (!scrubbed) continue;
      const key = intelResultFingerprint(scrubbed);

      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(scrubbed);
      if (merged.length >= MAX_ROWS) {
        return { count: merged.length, results: merged };
      }
    }
  }

  return merged.length > 0 ? { count: merged.length, results: merged } : null;
}

function flattenUniversalResults(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const results = payload.results;

  if (results && typeof results === "object" && !Array.isArray(results)) {
    for (const [sourceKey, value] of Object.entries(
      results as Record<string, unknown>,
    )) {
      const before = rows.length;

      collectRows(value, rows);
      // Tag rows that came from a named nested source when they lack database
      for (let i = before; i < rows.length; i++) {
        if (
          !asString(rows[i].database) &&
          !META_KEYS.has(sourceKey) &&
          !isInternalSourceLabel(sourceKey)
        ) {
          rows[i] = { ...rows[i], database: sourceKey };
        }
      }
    }
  } else {
    collectRows(results ?? payload, rows);
  }

  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];

  for (const row of rows) {
    const scrubbed = scrubIntelRecord(row);

    if (!scrubbed) continue;
    // Reject meta-only databank labels like "source" / provider names.
    if (
      typeof scrubbed.database === "string" &&
      isInternalSourceLabel(scrubbed.database)
    ) {
      delete scrubbed.database;
      if (!scrubIntelRecord(scrubbed)) continue;
    }
    const key = intelResultFingerprint(scrubbed);

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(scrubbed);
    if (deduped.length >= MAX_ROWS) break;
  }

  return deduped;
}

export function detectCsintSearchType(query: string): CsintSearchType {
  const trimmed = query.trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return "ip";
  if (
    /^[\d\s+\-().]+$/.test(trimmed) &&
    trimmed.replace(/\D/g, "").length >= 10
  ) {
    return "phone";
  }

  return "username";
}

export function mapGodsEyeTypeToCsint(
  type: string | undefined,
): CsintSearchType {
  switch ((type || "").toLowerCase()) {
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "ip":
      return "ip";
    case "username":
    case "minecraft":
    case "steam":
    case "telegram":
    case "instagram":
    case "snapchat":
    case "tiktok":
    case "twitter":
    case "github":
    case "reddit":
    case "name":
    case "password":
      return "username";
    default:
      return "auto";
  }
}

export async function fetchCsintUniversalSearch(
  query: string,
  type: CsintSearchType = "auto",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;

  try {
    const payload = await csintPost(
      "/search",
      { query: query.trim(), type },
      timeoutMs,
    );
    const results = flattenUniversalResults(payload);

    return { count: results.length, results };
  } catch {
    return null;
  }
}

export async function fetchCsintUniversalSearchOrThrow(
  query: string,
  type: CsintSearchType = "auto",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse> {
  if (!isCsintEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const payload = await csintPost(
    "/search",
    { query: query.trim(), type },
    timeoutMs,
  );
  const results = flattenUniversalResults(payload);

  return { count: results.length, results };
}

export function csintRowsToCredentials(results: unknown[]): CombCredential[] {
  const credentials: CombCredential[] = [];
  const seen = new Set<string>();

  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const identifier =
      asString(record.email) ||
      asString(record.username) ||
      asString(record.phone) ||
      asString(record.ip) ||
      asString(record.name);
    const secret =
      asString(record.password) ||
      asString(record.pass) ||
      asString(record.hash);

    if (!identifier && !secret) continue;
    if (identifier && isBrandPlaceholderValue(identifier)) continue;
    if (secret && isBrandPlaceholderValue(secret)) continue;

    const id = identifier || "(unknown)";

    if (isBrandPlaceholderValue(id)) continue;

    const breachSource =
      asString(record.database) ||
      asString(record.dbname) ||
      asString(record.origin) ||
      asString(record.title);
    const raw = secret ? `${id}:${secret}` : id;
    const fields = connectedFieldsFromBreachRecord(record, {
      identifier: id,
      secret,
    });
    const key = secret
      ? `${id.toLowerCase()}\0${secret}`
      : `${id.toLowerCase()}\0\0${(breachSource || raw).toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);

    credentials.push({
      identifier: id,
      secret,
      raw: breachSource ? `${breachSource} · ${raw}` : raw,
      ...(fields.length > 0 ? { fields } : {}),
    });
  }

  return credentials;
}

export async function fetchCsintDiscordLookup(
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  try {
    const payload = await csintPost("/discord/lookup", { user_id: userId });

    if (isCsintRateLimitPayload(payload)) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function fetchCsintDiscordOsint(
  userId: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  try {
    const payload = await csintPost("/discord/osint", { user_id: userId });

    if (isCsintRateLimitPayload(payload)) return null;

    const results: Record<string, unknown>[] = [];

    if (
      asString(payload.email) ||
      asString(payload.ip) ||
      asString(payload.ip_address)
    ) {
      const scrubbed = scrubIntelRecord({
        email: asString(payload.email) || undefined,
        ip: asString(payload.ip) || asString(payload.ip_address) || undefined,
        user_id: userId,
      });

      if (scrubbed) results.push(scrubbed);
    }

    collectRows(payload, results);

    return results.length > 0 ? { count: results.length, results } : null;
  } catch {
    return null;
  }
}

export function extractCsintDiscordLookupLeaks(
  lookup: Record<string, unknown> | null,
  userId: string,
): SanitizedBreachResponse {
  if (!lookup) return { count: 0, results: [] };

  const osint = lookup.osint_data;

  if (!osint || typeof osint !== "object") {
    return { count: 0, results: [] };
  }

  const o = osint as Record<string, unknown>;
  const email = asString(o.email);
  const ip = asString(o.ip) || asString(o.ip_address);

  if (!email && !ip) return { count: 0, results: [] };

  const scrubbed = scrubIntelRecord({
    email: email || undefined,
    ip: ip || undefined,
    user_id: userId,
  });

  if (!scrubbed) return { count: 0, results: [] };

  return {
    count: 1,
    results: [scrubbed],
  };
}

export async function fetchCsintIpLookup(
  ip: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled()) return null;
  try {
    return await csintPost("/iplookup", { ip: ip.trim() });
  } catch {
    return null;
  }
}

export async function fetchCsintCrypto(
  address: string,
  crypto: "BTC" | "ETH" | "LTC" | "DOGE",
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled()) return null;
  try {
    return await csintPost("/crypto", { address: address.trim(), crypto });
  } catch {
    return null;
  }
}

export function detectCsintCryptoSymbol(
  address: string,
): "BTC" | "ETH" | "LTC" | "DOGE" | null {
  const a = address.trim();

  if (!a || /\s/.test(a) || a.includes("@")) return null;
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "ETH";
  // Align with on-chain wallet detector: bech32 bc1… or Base58Check 1…/3…
  if (/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/i.test(a)) return "BTC";
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,33}$/.test(a)) return "BTC";
  // Litecoin: bech32 ltc1… or legacy L…/M…
  if (/^ltc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/i.test(a)) return "LTC";
  if (/^[LM][a-km-zA-HJ-NP-Z1-9]{25,33}$/.test(a)) return "LTC";
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(a)) return "DOGE";

  return null;
}

export async function fetchCsintReddit(
  username: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled()) return null;
  try {
    const cleaned = username.trim().replace(/^u\//i, "");

    return await csintPost("/reddit", { username: cleaned });
  } catch {
    return null;
  }
}

/**
 * Flatten a CSINT profile/entity payload into one scrubbed intel card row.
 * Nested objects are skipped so ModuleSearchView can render scalar fields.
 */
export function flattenCsintEntity(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!payload) return null;

  const candidates: unknown[] = [
    payload.profile,
    payload.data,
    payload.user,
    payload.result,
    payload.sharer,
    payload.account,
    // Reddit recon nests account scalars under raw_stats.account
    (payload.raw_stats as Record<string, unknown> | undefined)?.account,
    payload,
  ];

  const flat: Record<string, unknown> = {};

  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }

    for (const [key, value] of Object.entries(
      candidate as Record<string, unknown>,
    )) {
      if (key in flat) continue;
      if (META_KEYS.has(key) || /csint/i.test(key)) continue;
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "object") continue;
      flat[key] = value;
    }
  }

  // TikTok recon: merge top-level stats scalars (followers/following/etc.)
  const stats = payload.stats;

  if (stats && typeof stats === "object" && !Array.isArray(stats)) {
    for (const [key, value] of Object.entries(
      stats as Record<string, unknown>,
    )) {
      if (key in flat) continue;
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "object") continue;
      flat[key] = value;
    }
  }

  // Reddit: a few useful AI summary strings when present
  const ai = payload.ai_analysis;

  if (ai && typeof ai === "object" && !Array.isArray(ai)) {
    const a = ai as Record<string, unknown>;

    for (const key of [
      "summary",
      "likely_location",
      "estimated_age_range",
      "inferred_gender",
      "timezone_hint",
    ] as const) {
      const value = a[key];

      if (typeof value === "string" && value.trim() && !(key in flat)) {
        flat[key] = value.trim();
      }
    }
  }

  if (typeof payload.source_url === "string" && payload.source_url.trim()) {
    flat.source_url = payload.source_url.trim();
  }

  return scrubIntelRecord(flat);
}

export async function fetchCsintTiktokRecon(
  username: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled()) return null;
  try {
    return await csintPost("/tiktokrecon", { username: username.trim() });
  } catch {
    return null;
  }
}

export async function fetchCsintShareResolver(
  type: "instagram" | "tiktok",
  url: string,
): Promise<Record<string, unknown>> {
  return csintPost("/share-resolver", { type, url: url.trim() });
}

export async function fetchCsintEmailAnalyze(
  email: string,
): Promise<Record<string, unknown>> {
  return csintPost("/email/analyze", { email: email.trim() }, 45_000);
}

export async function fetchCsintMelissaLookup(
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  return csintPost("/melissa/lookup", body);
}

export async function fetchCsintMinecraft(
  query: string,
  type: "username" | "email" | "ip" | "password" | "uuid" = "username",
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;

  // crowsint/minecraft is gone from csint.pro — use universal search instead.
  const searchType: CsintSearchType =
    type === "email" ? "email" : type === "ip" ? "ip" : "username";

  return fetchCsintUniversalSearch(query, searchType);
}

export async function fetchCsintGithub(
  username: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;

  // intelfetch/github is metered and often 429; crowsint/github no longer exists.
  // Universal username search covers GitHub-linked breach hits without burning quota.
  return fetchCsintUniversalSearch(
    username.trim().replace(/^@/, ""),
    "username",
  );
}

export async function fetchCsintMinecraftServer(
  server: string,
): Promise<Record<string, unknown>> {
  return csintPost("/intelfetch/minecraft", { server: server.trim() });
}

export async function fetchCsintHashLookup(
  hash: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;
  try {
    const payload = await csintPost("/snusbase/hash-lookup", {
      hash: hash.trim(),
    });
    const sanitized = payloadToSanitized(payload);

    if (sanitized.count > 0) return sanitized;
    const scrubbed = scrubIntelRecord(payload);

    if (scrubbed) {
      return { count: 1, results: [scrubbed] };
    }

    return { count: 0, results: [] };
  } catch {
    return null;
  }
}

export function snusbaseTypesForCsint(
  type: CsintSearchType | string,
): string[] {
  switch ((type || "").toLowerCase()) {
    case "email":
      return ["email"];
    case "phone":
      return ["username"];
    case "ip":
      return ["lastip"];
    case "hash":
      return ["hash"];
    case "password":
      return ["password"];
    case "name":
      return ["name"];
    case "username":
    default:
      return ["username"];
  }
}

export async function fetchCsintSnusbaseSearch(
  term: string,
  types: string[],
  wildcard = false,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  const cleaned = term.trim();

  if (!cleaned || types.length === 0) return null;

  try {
    const payload = await csintPost("/snusbase/search", {
      terms: [cleaned],
      types,
      wildcard,
    });

    return payloadToSanitized(payload);
  } catch {
    return null;
  }
}

export async function fetchCsintBreachBase(
  term: string,
  searchType?: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  const cleaned = term.trim();

  if (!cleaned) return null;

  try {
    const body: Record<string, unknown> = { term: cleaned };

    if (searchType) body.search_type = searchType;
    const payload = await csintPost("/breachbase", body);

    return payloadToSanitized(payload);
  } catch {
    return null;
  }
}

/**
 * Only keep Discord→Roblox payloads that resolve a real Roblox username, user id,
 * or profile URL. Empty stubs / success:false / empty arrays count as no result.
 */
export function normalizeDiscordToRobloxPayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  if (payload.success === false) return null;

  const candidates: unknown[] = [
    payload,
    payload.data,
    payload.result,
    payload.roblox,
    payload.account,
    payload.user,
  ];

  if (Array.isArray(payload.results)) {
    candidates.push(...payload.results);
  }
  if (Array.isArray(payload.data)) {
    candidates.push(...payload.data);
  }

  const data = payload.data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;

    if (nested.success === false) return null;
    candidates.push(
      nested.roblox,
      nested.user,
      nested.account,
      nested.result,
      nested.data,
    );
    if (Array.isArray(nested.results)) candidates.push(...nested.results);
  }

  for (const candidate of candidates) {
    const resolved = tryNormalizeRobloxAccount(candidate);

    if (resolved) return resolved;
  }

  return null;
}

function tryNormalizeRobloxAccount(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;

  if (record.success === false) return null;

  if (Array.isArray(record.results) && record.results.length === 0) {
    const hasOwnIdentity =
      asString(record.username) ||
      asString(record.roblox_username) ||
      asString(record.robloxUsername) ||
      asString(record.userId) ||
      asString(record.roblox_id) ||
      asString(record.robloxId);

    if (!hasOwnIdentity) return null;
  }

  const username = asString(
    record.username ??
      record.roblox_username ??
      record.robloxUsername ??
      record.RobloxUsername,
  );

  let userId = asString(
    record.userId ??
      record.roblox_id ??
      record.robloxId ??
      record.userid ??
      record.RobloxId,
  );

  if (!userId) {
    const maybe = asString(record.user_id ?? record.id);

    // Prefer Roblox-sized numeric ids; skip Discord snowflakes (17–20 digits).
    if (maybe && /^\d{1,16}$/.test(maybe)) {
      userId = maybe;
    }
  }

  let profileUrl = asString(
    record.profileUrl ??
      record.profile_url ??
      record.profile ??
      record.url ??
      record.link,
  );

  if (profileUrl && !/roblox\.com/i.test(profileUrl)) {
    profileUrl = "";
  }

  if (!profileUrl && userId && /^\d+$/.test(userId)) {
    profileUrl = `https://www.roblox.com/users/${userId}/profile`;
  }

  if (!profileUrl && username) {
    const handle = username.replace(/^@/, "");

    if (handle) {
      profileUrl = `https://www.roblox.com/users/profile?username=${encodeURIComponent(handle)}`;
    }
  }

  if (!username && !userId && !profileUrl) return null;

  const out: Record<string, unknown> = {};

  if (username) out.username = username;
  if (userId) out.userId = userId;
  if (profileUrl) out.profileUrl = profileUrl;

  return scrubIntelRecord(out);
}

export async function fetchCsintOathnetDiscordToRoblox(
  discordId: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  const cleaned = discordId.trim();

  if (!cleaned) return null;

  try {
    const payload = await csintPost("/oathnet/discord-to-roblox", {
      discord_id: cleaned,
    });
    const resolved = normalizeDiscordToRobloxPayload(payload);

    if (!resolved) return null;

    return {
      ...resolved,
      discord_id: cleaned,
    };
  } catch {
    return null;
  }
}

const SEON_META_KEYS = new Set([
  "success",
  "error",
  "errors",
  "message",
  "credits",
  "credit",
  "service",
  "source",
  "status",
  "took",
  "time",
  "elapsed",
]);

function unwrapSeonPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> | null {
  const nested = payload.data;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (SEON_META_KEYS.has(key) || key === "data") continue;
    rest[key] = value;
  }

  return Object.keys(rest).length > 0 ? rest : null;
}

function pushScalarFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  keys: string[],
  rename?: Record<string, string>,
) {
  for (const key of keys) {
    const value = source[key];

    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") continue;
    const outKey = rename?.[key] ?? key;

    target[outKey] = value;
  }
}

function seonRegisteredAccounts(accountDetails: unknown): string[] {
  if (!accountDetails || typeof accountDetails !== "object") return [];

  const registered: string[] = [];

  for (const [name, info] of Object.entries(
    accountDetails as Record<string, unknown>,
  )) {
    if (!info || typeof info !== "object" || Array.isArray(info)) continue;
    if ((info as Record<string, unknown>).registered === true) {
      registered.push(name.replace(/_/g, " "));
    }
  }

  return registered.sort((a, b) => a.localeCompare(b));
}

function seonBreachSummary(
  breachDetails: unknown,
): Record<string, unknown> | null {
  if (
    !breachDetails ||
    typeof breachDetails !== "object" ||
    Array.isArray(breachDetails)
  ) {
    return null;
  }

  const breach = breachDetails as Record<string, unknown>;
  const out: Record<string, unknown> = { category: "Breach history" };

  pushScalarFields(out, breach, [
    "haveibeenpwned_listed",
    "number_of_breaches",
    "first_breach",
  ]);

  if (Array.isArray(breach.breaches) && breach.breaches.length > 0) {
    out.breaches = breach.breaches
      .map((entry) => {
        if (!entry || typeof entry !== "object") return String(entry ?? "");
        const row = entry as Record<string, unknown>;
        const name = asString(row.name) || "Unknown";
        const date = asString(row.date);

        return date ? `${name} (${date})` : name;
      })
      .filter(Boolean)
      .join(", ");
  }

  return Object.keys(out).length > 1 ? out : null;
}

function seonRiskRules(appliedRules: unknown): Record<string, unknown> | null {
  if (!Array.isArray(appliedRules) || appliedRules.length === 0) return null;

  const rules = appliedRules
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const name = asString(row.name);
      const op = asString(row.operation);
      const score =
        typeof row.score === "number" || typeof row.score === "string"
          ? String(row.score)
          : "";
      const scoreBit = score ? ` (${op || "+"}${score})` : "";
      const label = [id, name].filter(Boolean).join(": ");

      return `${label}${scoreBit}`.trim();
    })
    .filter(Boolean);

  if (rules.length === 0) return null;

  return {
    category: "Risk rules",
    rule_count: rules.length,
    rules: rules.join("; "),
  };
}

function seonDomainCard(
  domainDetails: unknown,
): Record<string, unknown> | null {
  if (
    !domainDetails ||
    typeof domainDetails !== "object" ||
    Array.isArray(domainDetails)
  ) {
    return null;
  }

  const domain = domainDetails as Record<string, unknown>;
  const out: Record<string, unknown> = { category: "Domain details" };

  pushScalarFields(out, domain, [
    "domain",
    "tld",
    "registered",
    "created",
    "updated",
    "expires",
    "registrar_name",
    "registered_to",
    "disposable",
    "free",
    "custom",
    "dmarc_enforced",
    "spf_strict",
    "valid_mx",
    "accept_all",
    "suspicious_tld",
    "website_exists",
  ]);

  return Object.keys(out).length > 1 ? out : null;
}

/**
 * CSINT SEON wraps useful signals under `data` and returns meta like
 * `{ success, source }`. Flatten into SearchResultCards-friendly rows.
 */
export function normalizeSeonFootprint(
  payload: Record<string, unknown>,
  kind: "email" | "phone",
): { count: number; results: Record<string, unknown>[] } {
  const root = unwrapSeonPayload(payload);

  if (!root) {
    return { count: 0, results: [] };
  }

  const results: Record<string, unknown>[] = [];

  const reputation: Record<string, unknown> = {
    category: kind === "email" ? "Email reputation" : "Phone reputation",
  };

  if (kind === "email") {
    pushScalarFields(reputation, root, ["email", "score", "deliverable"]);
  } else {
    pushScalarFields(
      reputation,
      root,
      [
        "number",
        "phone",
        "score",
        "valid",
        "disposable",
        "type",
        "country",
        "carrier",
      ],
      { number: "phone" },
    );
  }

  if (Object.keys(reputation).length > 1) {
    results.push(reputation);
  }

  const domainCard = seonDomainCard(root.domain_details);

  if (domainCard) results.push(domainCard);

  const registered = seonRegisteredAccounts(root.account_details);

  if (registered.length > 0) {
    results.push({
      category: "Digital footprint",
      registered_account_count: registered.length,
      registered_accounts: registered.join(", "),
    });
  }

  const breachCard = seonBreachSummary(root.breach_details);

  if (breachCard) results.push(breachCard);

  const rulesCard = seonRiskRules(root.applied_rules);

  if (rulesCard) results.push(rulesCard);

  // Fallback: flatten leftover scalars if nested sections were empty.
  if (results.length === 0) {
    const flat: Record<string, unknown> = {
      category: kind === "email" ? "Email reputation" : "Phone reputation",
    };

    for (const [key, value] of Object.entries(root)) {
      if (
        SEON_META_KEYS.has(key) ||
        key === "account_details" ||
        key === "domain_details" ||
        key === "breach_details" ||
        key === "applied_rules" ||
        value === null ||
        value === undefined ||
        value === "" ||
        typeof value === "object"
      ) {
        continue;
      }
      flat[key] = value;
    }
    if (Object.keys(flat).length > 1) results.push(flat);
  }

  return { count: results.length, results };
}

export async function fetchCsintSeonEmail(
  email: string,
): Promise<Record<string, unknown>> {
  const payload = await csintPost("/seon/email", { email: email.trim() });

  return normalizeSeonFootprint(payload, "email");
}

export async function fetchCsintSeonPhone(
  phone: string,
): Promise<Record<string, unknown>> {
  const payload = await csintPost("/seon/phone", { phone: phone.trim() });

  return normalizeSeonFootprint(payload, "phone");
}

/**
 * Parallel additive CSINT breach sources (universal + BreachBase + Snusbase).
 * Soft-fails individually so one down provider does not wipe the rest.
 * OathNet breach/stealer is omitted — paywalled previews return ***UPGRADE_TO_SEE***.
 */
export async function fetchCsintAdditiveBreachSearch(
  query: string,
  type: CsintSearchType = "auto",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;

  const cleaned = query.trim();

  if (!cleaned) return null;

  const resolvedType = type === "auto" ? detectCsintSearchType(cleaned) : type;
  const snusTypes = snusbaseTypesForCsint(resolvedType);

  // Sequential through the shared CSINT queue — Promise.all only raced the
  // gate acquire and still overlapped in-flight work before serialization.
  const universal = await fetchCsintUniversalSearch(
    cleaned,
    resolvedType,
    timeoutMs,
  );
  const breachBase = await fetchCsintBreachBase(cleaned, resolvedType);
  const snusbase = await fetchCsintSnusbaseSearch(cleaned, snusTypes);

  return mergeOptionalSanitized(universal, breachBase, snusbase);
}

/**
 * Stealer-oriented additive sources (universal + BreachBase).
 * OathNet stealer/breach omitted — paywalled ***UPGRADE_TO_SEE*** previews only.
 */
export async function fetchCsintAdditiveStealerSearch(
  query: string,
  type: CsintSearchType = "auto",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;

  const cleaned = query.trim();

  if (!cleaned) return null;

  const resolvedType = type === "auto" ? detectCsintSearchType(cleaned) : type;

  const universal = await fetchCsintUniversalSearch(
    cleaned,
    resolvedType,
    timeoutMs,
  );
  const breachBase = await fetchCsintBreachBase(cleaned, resolvedType);

  return mergeOptionalSanitized(universal, breachBase);
}

export async function fetchCsintShodanHost(
  ip: string,
  timeoutMs = SHODAN_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const cleaned = ip.trim();
  const raw = await withDeadline(
    csintPost("/shodan/host", { ip: cleaned, history: false }, timeoutMs),
    timeoutMs + 2_000,
    "Host exposure lookup timed out. Try again.",
  );

  return {
    query: cleaned,
    ...compactShodanHostPayload(raw),
  };
}

export async function fetchCsintIntelx(
  storageId: string,
  bucket: IntelxBucket | string = DEFAULT_INTELX_BUCKET,
): Promise<{ content: string; error?: string; bucket: IntelxBucket }> {
  const resolvedBucket = isIntelxBucket(bucket)
    ? bucket
    : DEFAULT_INTELX_BUCKET;

  if (!isCsintEnabled()) {
    return {
      content: "",
      error: publicServiceUnavailable(),
      bucket: resolvedBucket,
    };
  }

  if (isCsintCoolingDown()) {
    return {
      content: "",
      error: csintRateLimitMessage(),
      bucket: resolvedBucket,
    };
  }

  const apiKey = getCsintApiKey();

  if (!apiKey) {
    return {
      content: "",
      error: publicServiceUnavailable(),
      bucket: resolvedBucket,
    };
  }

  try {
    return await withCsintSlot(async () => {
      const res = await fetchWithTimeout(`${CSINT_BASE}/intelx`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify({
          storageid: storageId.trim(),
          bucket: resolvedBucket,
        }),
        cache: "no-store",
        timeoutMs: 60_000,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const text = await readResponseText(res, 60_000);

      // Docs: success is raw text/plain; errors are JSON.
      // Always strip csint.pro / "powered by csint tools" credits from dumps.
      if (contentType.includes("text/plain") && res.ok && text.trim()) {
        return { content: sanitizePublicContent(text), bucket: resolvedBucket };
      }

      let data: Record<string, unknown> = {};

      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        if (res.ok && text.trim()) {
          return {
            content: sanitizePublicContent(text),
            bucket: resolvedBucket,
          };
        }
      }

      if (isCsintRateLimitPayload(data) || res.status === 429) {
        noteCsintCooldown(data, res.status);
      }

      if (data.success === true && typeof data.content === "string") {
        return {
          content: sanitizePublicContent(data.content),
          bucket: resolvedBucket,
        };
      }

      // Prefer details (e.g. "HTTP 404") when present — clearer than the generic error title.
      const msg =
        (typeof data.details === "string" && data.details) ||
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        (res.status === 429
          ? "Storage export rate limit reached. Try again later."
          : `Storage export failed (HTTP ${res.status})`);

      return {
        content: "",
        error: sanitizeCsintError(msg),
        bucket: resolvedBucket,
      };
    });
  } catch (err) {
    return {
      content: "",
      error:
        err instanceof Error
          ? sanitizeCsintError(err.message)
          : publicSearchError(),
      bucket: resolvedBucket,
    };
  }
}

export async function fetchCsintIntelxWithBuckets(
  storageId: string,
  preferredBucket?: string | null,
): Promise<{ content: string; error?: string; bucket: IntelxBucket }> {
  // Keep fan-out small — IntelX is limited to ~50 requests/day (+ ~3 rps).
  // No UI bucket picker: try the common docs buckets silently.
  const preferred = preferredBucket?.trim();
  const ordered: IntelxBucket[] = [
    preferred && isIntelxBucket(preferred) ? preferred : null,
    DEFAULT_INTELX_BUCKET,
    "leaks.private",
    "leaks.logs",
    "dumpster",
    "pastes",
  ].filter(
    (b, i, arr): b is IntelxBucket => Boolean(b) && arr.indexOf(b) === i,
  );

  let lastError = "No export content returned.";

  for (const bucket of ordered) {
    const result = await fetchCsintIntelx(storageId, bucket);

    if (result.content.trim()) {
      return result;
    }
    if (result.error) {
      lastError = result.error;
      // Stop on quota; keep trying alternate buckets on 404 (wrong bucket is common).
      if (/rate limit|429|capacity|quota/i.test(result.error)) {
        return { content: "", error: result.error, bucket };
      }
    }
  }

  return {
    content: "",
    error: lastError,
    bucket: ordered[0] || DEFAULT_INTELX_BUCKET,
  };
}

export async function probeCsint(): Promise<boolean> {
  if (!isCsintEnabled()) return false;
  try {
    await csintPost("/status", {}, 8_000);

    return true;
  } catch {
    return false;
  }
}
