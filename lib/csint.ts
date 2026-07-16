/**
 * csint.pro intelligence client.
 * Key via CSINT_API_KEY. Set CSINT_ENABLED=false to disable without removing the key.
 */

import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import type { CombCredential } from "@/lib/proxynova-comb";

const CSINT_BASE = "https://csint.pro/api";
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_ROWS = 200;

export type CsintSearchType =
  | "email"
  | "phone"
  | "username"
  | "ip"
  | "auto";

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
  if (lower.includes("rate") && (lower.includes("limit") || lower.includes("429"))) {
    return "Too many searches right now. Wait a minute and try again.";
  }
  if (lower.includes("unauthorized") || lower.includes("invalid api")) {
    return publicServiceUnavailable();
  }

  return cleaned;
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

  const text = await res.text();
  let data: Record<string, unknown> = {};

  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    if (!res.ok) {
      throw new Error(sanitizeCsintError(`HTTP ${res.status}`));
    }
    throw new Error(publicSearchError("Invalid response from intelligence index."));
  }

  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(sanitizeCsintError(msg));
  }

  if (data.success === false) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      publicSearchError();
    throw new Error(sanitizeCsintError(msg));
  }

  return sanitizeCsintPayload(data);
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
      /csint/i.test(key)
    ) {
      continue;
    }

    if (typeof raw === "string") {
      out[key] = sanitizePublicText(raw);
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

  out.source = PUBLIC_INTEL_SOURCE;
  return out;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function collectRows(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, out);
    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  // Nested source wrappers from unified search
  if (
    record.data &&
    typeof record.data === "object" &&
    (record.success === true || record.success === false)
  ) {
    collectRows(record.data, out);
    return;
  }

  for (const key of [
    "results",
    "records",
    "entries",
    "items",
    "leaks",
    "breach_data",
    "rows",
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
        if (typeof value === "string") {
          const trimmed = value.trim();
          const [left, ...rest] = trimmed.split(":");
          out.push({
            database: breachName,
            email: left?.includes("@") ? left : undefined,
            username: left && !left.includes("@") ? left : undefined,
            password: rest.length > 0 ? rest.join(":") : trimmed || undefined,
            raw: trimmed || breachName,
            source: PUBLIC_INTEL_SOURCE,
          });
        } else if (Array.isArray(value)) {
          collectRows(value, out);
        } else if (value && typeof value === "object") {
          out.push({
            ...(value as Record<string, unknown>),
            database: breachName,
            source: PUBLIC_INTEL_SOURCE,
          });
        } else {
          out.push({
            database: breachName,
            source: PUBLIC_INTEL_SOURCE,
          });
        }
      }
      return;
    }
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
    asString(record.ip_address)
  ) {
    out.push({ ...record, source: PUBLIC_INTEL_SOURCE });
  }
}

function flattenUniversalResults(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const results = payload.results;

  if (results && typeof results === "object" && !Array.isArray(results)) {
    for (const value of Object.values(results as Record<string, unknown>)) {
      collectRows(value, rows);
    }
  } else {
    collectRows(results, rows);
  }

  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= MAX_ROWS) break;
  }

  return deduped;
}

export function detectCsintSearchType(query: string): CsintSearchType {
  const trimmed = query.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return "ip";
  if (/^[\d\s+\-().]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 10) {
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
  if (!isCsintEnabled()) return null;

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

export function csintRowsToCredentials(
  results: unknown[],
): CombCredential[] {
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

    const id = identifier || "(unknown)";
    const key = `${id.toLowerCase()}\0${secret}`;
    if (seen.has(key)) continue;
    seen.add(key);

    credentials.push({
      identifier: id,
      secret,
      raw: secret ? `${id}:${secret}` : id,
    });
  }

  return credentials;
}

export async function fetchCsintDiscordLookup(
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!isCsintEnabled()) return null;
  try {
    return await csintPost("/discord/lookup", { user_id: userId });
  } catch {
    return null;
  }
}

export async function fetchCsintDiscordOsint(
  userId: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;
  try {
    const payload = await csintPost("/discord/osint", { user_id: userId });
    const results: Record<string, unknown>[] = [];

    if (
      asString(payload.email) ||
      asString(payload.ip) ||
      asString(payload.ip_address)
    ) {
      results.push({
        email: asString(payload.email) || undefined,
        ip: asString(payload.ip) || asString(payload.ip_address) || undefined,
        user_id: userId,
        source: PUBLIC_INTEL_SOURCE,
      });
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

  return {
    count: 1,
    results: [
      {
        email: email || undefined,
        ip: ip || undefined,
        user_id: userId,
        source: PUBLIC_INTEL_SOURCE,
      },
    ],
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
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "ETH";
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(a)) return "BTC";
  if (/^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(a)) return "LTC";
  if (/^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/.test(a)) return "DOGE";
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

export async function fetchCsintImageGeolocate(
  imageBase64: string,
): Promise<Record<string, unknown>> {
  // Provider accepts raw base64 or data-URL; prefer raw payload.
  const trimmed = imageBase64.trim();
  const raw = trimmed.includes(",")
    ? trimmed.slice(trimmed.indexOf(",") + 1)
    : trimmed.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "");

  if (!raw || raw.length < 100) {
    throw new Error("Image is too small or invalid. Use a real photo URL.");
  }

  return csintPost("/geolocate", { image: raw }, 45_000);
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
  return fetchCsintUniversalSearch(username.trim().replace(/^@/, ""), "username");
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
    const results: Record<string, unknown>[] = [];
    collectRows(payload, results);
    if (results.length === 0 && Object.keys(payload).length > 0) {
      results.push({ ...payload, source: PUBLIC_INTEL_SOURCE });
    }
    return { count: results.length, results };
  } catch {
    return null;
  }
}

export async function fetchCsintShodanHost(
  ip: string,
): Promise<Record<string, unknown>> {
  return csintPost("/shodan/host", { ip: ip.trim(), history: false });
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
