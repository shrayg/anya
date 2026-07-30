/**
 * Discord specialty API — user, history, export, snowflake.
 *
 * Site routes: GET /api/discord/{user,history,export,snowflake}
 *
 * Upstream (in priority order):
 * 1. BreachHub GET /api/discord/* (BREACHHUB_API_KEY)
 * 2. Fallbacks:
 *    - user → fetchDiscordProfile + OathNet userinfo via BreachHub
 *    - history → OathNet username-history via BreachHub
 *    - snowflake → local ID decode (always available)
 *    - export → compose user + history payloads
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import { fetchBreachHubRaw, isBreachHubEnabled } from "@/lib/breachhub";
import {
  fetchDiscordProfile,
  snowflakeCreatedAt,
} from "@/lib/discord-profile";
import {
  filterIntelResultsForQuery,
  scrubIntelResults,
} from "@/lib/intel-record";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const DISCORD_EPOCH_MS = 1_420_070_400_000n;

export const DISCORD_API_ENDPOINTS = [
  "user",
  "history",
  "export",
  "snowflake",
] as const;

export type DiscordApiEndpoint = (typeof DISCORD_API_ENDPOINTS)[number];

export type DiscordApiSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: DiscordApiEndpoint;
  source: "breachhub" | "local" | "compose";
  raw?: Record<string, unknown>;
};

const ENDPOINT_SET = new Set<string>(DISCORD_API_ENDPOINTS);

/** BreachHub catalog ids that mirror these specialty Discord routes. */
export const DISCORD_API_BREACHHUB_ENDPOINT_IDS = [
  "discord-user",
  "discord-history",
  "discord-export",
  "discord-snowflake",
  "discord-lookup",
  "oathnet-discord-userinfo",
  "oathnet-discord-history",
] as const;

export function isDiscordApiEndpoint(
  value: string,
): value is DiscordApiEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function isDiscordApiEnabled(): boolean {
  if (process.env.DISCORD_API_ENABLED === "false") return false;

  // Snowflake always works locally; other endpoints fall back when BH is up.
  return true;
}

function sanitizeDiscordApiError(message: string): string {
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
    lower.includes("too many requests")
  ) {
    return "Provider rate limit reached. Try again in a moment.";
  }

  return cleaned;
}

/** Pull a Discord ID from common client query param names. */
export function pickDiscordId(input: Record<string, string>): string {
  for (const key of [
    "query",
    "id",
    "discord_id",
    "discordId",
    "snowflake",
    "user_id",
    "userId",
  ]) {
    const value = input[key]?.trim();

    if (value) return value;
  }

  return "";
}

export function decodeDiscordSnowflake(id: string): Record<string, unknown> {
  const snowflake = BigInt(id);
  const createdMs = Number((snowflake >> 22n) + DISCORD_EPOCH_MS);
  const createdAt = new Date(createdMs).toISOString();
  const workerId = Number((snowflake & 0x3e0000n) >> 17n);
  const processId = Number((snowflake & 0x1f000n) >> 12n);
  const increment = Number(snowflake & 0xfffn);

  return {
    id,
    createdAt,
    createdAtMs: createdMs,
    createdAtUnix: Math.floor(createdMs / 1000),
    workerId,
    processId,
    increment,
    profileUrl: `https://discord.com/users/${encodeURIComponent(id)}`,
  };
}

function extractPayloadRows(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.history)) return payload.history;

  const nested = payload.data;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>;

    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.history)) return obj.history;
    if (Array.isArray(obj.data)) return obj.data;

    const hasUseful = Object.keys(obj).some(
      (key) => !["success", "message", "error", "status", "ok"].includes(key),
    );

    if (hasUseful) return [obj];
  }

  const hasUseful = Object.keys(payload).some(
    (key) =>
      !["success", "message", "error", "status", "ok", "count"].includes(key),
  );

  return hasUseful ? [payload] : [];
}

function payloadToRows(
  payload: Record<string, unknown> | null,
  discordId: string,
): unknown[] {
  if (!payload) return [];

  return scrubIntelResults(
    filterIntelResultsForQuery(discordId, extractPayloadRows(payload)),
  );
}

async function fetchBreachHubDiscordEndpoint(
  endpointId: string,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  if (!isBreachHubEnabled()) return null;

  try {
    return await fetchBreachHubRaw(endpointId, params, {}, timeoutMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    throw new Error(sanitizeDiscordApiError(message));
  }
}

async function fetchUser(
  discordId: string,
  timeoutMs: number,
): Promise<DiscordApiSearchResult> {
  const primary = await fetchBreachHubDiscordEndpoint(
    "discord-user",
    { id: discordId },
    timeoutMs,
  ).catch(() => null);

  let rows = payloadToRows(primary, discordId);
  let source: DiscordApiSearchResult["source"] = "breachhub";
  let raw = primary ?? undefined;

  if (rows.length === 0) {
    const lookup = await fetchBreachHubDiscordEndpoint(
      "discord-lookup",
      { id: discordId },
      timeoutMs,
    ).catch(() => null);
    const oath = await fetchBreachHubDiscordEndpoint(
      "oathnet-discord-userinfo",
      { discord_id: discordId },
      timeoutMs,
    ).catch(() => null);

    rows = [
      ...payloadToRows(lookup, discordId),
      ...payloadToRows(oath, discordId),
    ];
    raw = lookup ?? oath ?? raw;
  }

  if (rows.length === 0) {
    const profile = await fetchDiscordProfile(discordId).catch(() => null);

    if (profile) {
      rows = scrubIntelResults([profile as unknown as Record<string, unknown>]);
      source = "local";
      raw = profile as unknown as Record<string, unknown>;
    }
  }

  return {
    count: rows.length,
    results: rows,
    query: discordId,
    endpoint: "user",
    source,
    ...(raw ? { raw } : {}),
  };
}

async function fetchHistory(
  discordId: string,
  timeoutMs: number,
): Promise<DiscordApiSearchResult> {
  const primary = await fetchBreachHubDiscordEndpoint(
    "discord-history",
    { id: discordId },
    timeoutMs,
  ).catch(() => null);

  let rows = payloadToRows(primary, discordId);
  const source: DiscordApiSearchResult["source"] = "breachhub";
  let raw = primary ?? undefined;

  if (rows.length === 0) {
    const alt = await fetchBreachHubDiscordEndpoint(
      "discord-history",
      { query: discordId },
      timeoutMs,
    ).catch(() => null);

    rows = payloadToRows(alt, discordId);
    raw = alt ?? raw;
  }

  if (rows.length === 0) {
    const oath = await fetchBreachHubDiscordEndpoint(
      "oathnet-discord-history",
      { discord_id: discordId },
      timeoutMs,
    ).catch(() => null);

    rows = payloadToRows(oath, discordId);
    raw = oath ?? raw;
  }

  return {
    count: rows.length,
    results: rows,
    query: discordId,
    endpoint: "history",
    source,
    ...(raw ? { raw } : {}),
  };
}

async function fetchSnowflake(
  discordId: string,
  timeoutMs: number,
): Promise<DiscordApiSearchResult> {
  const primary = await fetchBreachHubDiscordEndpoint(
    "discord-snowflake",
    { id: discordId },
    timeoutMs,
  ).catch(() => null);

  let rows = payloadToRows(primary, discordId);
  let source: DiscordApiSearchResult["source"] = "breachhub";
  let raw = primary ?? undefined;

  if (rows.length === 0) {
    const decoded = decodeDiscordSnowflake(discordId);

    rows = [decoded];
    source = "local";
    raw = decoded;
  }

  return {
    count: rows.length,
    results: rows,
    query: discordId,
    endpoint: "snowflake",
    source,
    ...(raw ? { raw } : {}),
  };
}

async function fetchExport(
  discordId: string,
  timeoutMs: number,
): Promise<DiscordApiSearchResult> {
  const primary = await fetchBreachHubDiscordEndpoint(
    "discord-export",
    { id: discordId },
    timeoutMs,
  ).catch(() => null);

  let rows = payloadToRows(primary, discordId);
  let source: DiscordApiSearchResult["source"] = "breachhub";
  let raw = primary ?? undefined;

  if (rows.length === 0) {
    const alt = await fetchBreachHubDiscordEndpoint(
      "discord-export",
      { query: discordId },
      timeoutMs,
    ).catch(() => null);

    rows = payloadToRows(alt, discordId);
    raw = alt ?? raw;
  }

  if (rows.length === 0) {
    const [user, history, snowflake] = await Promise.all([
      fetchUser(discordId, timeoutMs),
      fetchHistory(discordId, timeoutMs),
      fetchSnowflake(discordId, timeoutMs),
    ]);

    const composed: Record<string, unknown> = {
      id: discordId,
      createdAt: snowflakeCreatedAt(discordId),
      user: user.results,
      history: history.results,
      snowflake: snowflake.results,
      profileUrl: `https://discord.com/users/${encodeURIComponent(discordId)}`,
    };

    rows = [composed];
    source = "compose";
    raw = composed;
  }

  return {
    count: rows.length,
    results: rows,
    query: discordId,
    endpoint: "export",
    source,
    ...(raw ? { raw } : {}),
  };
}

/**
 * Run a Discord specialty endpoint. Throws on hard failures;
 * empty results are returned as count: 0.
 */
export async function fetchDiscordApiSanitized(
  endpoint: DiscordApiEndpoint,
  discordId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DiscordApiSearchResult> {
  const id = discordId.trim();

  if (!id) {
    throw new Error("Missing Discord ID.");
  }

  if (!isDiscordSnowflake(id)) {
    throw new Error("Enter a valid Discord ID (17–20 digits).");
  }

  if (!isDiscordApiEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  switch (endpoint) {
    case "user":
      return fetchUser(id, timeoutMs);
    case "history":
      return fetchHistory(id, timeoutMs);
    case "export":
      return fetchExport(id, timeoutMs);
    case "snowflake":
      return fetchSnowflake(id, timeoutMs);
    default:
      throw new Error("Unknown Discord endpoint.");
  }
}
