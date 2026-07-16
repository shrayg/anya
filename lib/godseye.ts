import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import { extractDatabank, isInternalSourceLabel } from "@/lib/intel-record";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { normalizeDomain } from "@/lib/domain-search";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { isDiscordSnowflake } from "@/lib/osintcat";

const GODSEYE_BASE = "https://godseye.cat";
const DEFAULT_GODSEYE_SEARCH_TIMEOUT_MS = 25_000;

/** GodsEye is on by default. Set GODSEYE_ENABLED=false to disable without removing keys. */
export function isGodsEyeEnabled(): boolean {
  return process.env.GODSEYE_ENABLED !== "false";
}

export function sanitizeGodsEyeUserError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("per-minute") ||
    lower.includes("per minute") ||
    (lower.includes("rate") && lower.includes("limit"))
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }

  if (lower.includes("daily") && lower.includes("limit")) {
    return "Daily search limit reached. Try again tomorrow.";
  }

  if (
    lower.includes("whitelist") ||
    lower.includes("ingress") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key")
  ) {
    return publicServiceUnavailable();
  }

  const cleaned = sanitizePublicText(message).trim();

  return cleaned || publicSearchError();
}

export async function fetchGodsEyeSearchResult(
  searchType: GodsEyeSearchType,
  query: string,
  timeoutMs = DEFAULT_GODSEYE_SEARCH_TIMEOUT_MS,
): Promise<SanitizedBreachResponse> {
  const data = await fetchGodsEyeSearch(searchType, query, timeoutMs);
  return sanitizeGodsEyeSearch(data);
}

export type GodsEyeResponse = Record<string, unknown>;

export type GodsEyeSearchType =
  | "email"
  | "username"
  | "ip"
  | "phone"
  | "domain"
  | "hash"
  | "password"
  | "discord"
  | "steam"
  | "name"
  | "auto"
  | "fivem"
  | "minecraft"
  | "roblox"
  | "tiktok"
  | "telegram"
  | "snapchat"
  | "instagram"
  | "twitter"
  | "reddit"
  | "github"
  | "crypto"
  | "bank";

/** All scopes supported by GodsEye `/api/v1/public/search`. */
export const GODSEYE_PUBLIC_SEARCH_SCOPES: GodsEyeSearchType[] = [
  "email",
  "username",
  "ip",
  "phone",
  "domain",
  "hash",
  "password",
  "discord",
  "steam",
  "name",
  "auto",
  "fivem",
  "minecraft",
  "roblox",
  "tiktok",
  "telegram",
  "snapchat",
  "instagram",
  "twitter",
  "reddit",
  "github",
  "crypto",
  "bank",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const SLUG_TO_SEARCH_TYPE: Record<string, GodsEyeSearchType> = {
  "stealer-logs": "auto",
  username: "username",
  phone: "phone",
  ip: "ip",
  steam: "steam",
  telegram: "telegram",
  instagram: "instagram",
  snapchat: "snapchat",
  tiktok: "tiktok",
  twitter: "twitter",
  github: "github",
  reddit: "reddit",
  roblox: "roblox",
  minecraft: "minecraft",
  "discord-id": "discord",
  fivem: "fivem",
  "crypto-wallet": "crypto",
  "bank-search": "bank",
  breaches: "email",
  domain: "domain",
  "hash-lookup": "hash",
  "password-search": "password",
  "name-search": "name",
  tinder: "username",
  bumble: "username",
  hinge: "username",
  match: "username",
  okcupid: "username",
  pof: "username",
  grindr: "username",
  badoo: "username",
};

const MODULE_TO_SEARCH_TYPE: Record<string, GodsEyeSearchType> = {
  breach: "auto",
  breaches: "email",
  ip: "ip",
  discord: "discord",
  roblox: "roblox",
  reddit: "reddit",
  minecraft: "minecraft",
  "crypto-wallet": "crypto",
  bank: "bank",
};

export function getGodsEyeApiKey(): string | undefined {
  if (!isGodsEyeEnabled()) return undefined;

  return process.env.GODSEYE_API_KEY;
}

export function getGodsEyeExportApiKey(): string | undefined {
  if (!isGodsEyeEnabled()) return undefined;

  return process.env.GODSEYE_EXPORT_API_KEY;
}

export function resolveGodsEyeSearchType(
  query: string,
  scope?: string | null,
  moduleHint?: string | null,
): GodsEyeSearchType {
  const trimmed = query.trim();

  if (scope && SLUG_TO_SEARCH_TYPE[scope]) {
    return SLUG_TO_SEARCH_TYPE[scope];
  }

  if (moduleHint && MODULE_TO_SEARCH_TYPE[moduleHint]) {
    return MODULE_TO_SEARCH_TYPE[moduleHint];
  }

  if (EMAIL_RE.test(trimmed)) return "email";
  if (IP_RE.test(trimmed)) return "ip";
  if (isDiscordSnowflake(trimmed)) return "discord";
  if (normalizeDomain(trimmed)) return "domain";

  return "auto";
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Godseye-Api-Key": apiKey,
  };
}

async function parseGodsEyeJson(res: Response): Promise<GodsEyeResponse> {
  const text = await res.text();

  try {
    return JSON.parse(text) as GodsEyeResponse;
  } catch {
    return { raw: text };
  }
}

function tagIntelRecord(entry: unknown): unknown {
  if (!entry || typeof entry !== "object") return entry;

  const record = { ...(entry as Record<string, unknown>) };
  const source = record.source;

  if (typeof source === "string") {
    const trimmed = source.trim();

    if (!trimmed || isInternalSourceLabel(trimmed)) {
      delete record.source;
    } else {
      record.source = trimmed;
    }
  }

  if (typeof record._source === "string" && isInternalSourceLabel(record._source)) {
    delete record._source;
  }

  return record;
}

function pushUniqueRecord(seen: Set<string>, results: unknown[], entry: unknown) {
  const tagged = tagIntelRecord(entry);
  const key = JSON.stringify(tagged);

  if (seen.has(key)) return;

  seen.add(key);
  results.push(tagged);
}

/** Flatten nested unified-search payloads (`results[].data.results`). */
export function flattenGodsEyeUnifiedResults(
  data: GodsEyeResponse | null,
): unknown[] {
  if (!data) return [];

  const seen = new Set<string>();
  const flattened: unknown[] = [];
  const top = data.results;

  if (!Array.isArray(top)) {
    return flattened;
  }

  for (const block of top) {
    if (!block || typeof block !== "object") continue;

    const provider = block as Record<string, unknown>;

    if (provider.ok === false) continue;

    const inner = provider.data;

    if (!inner || typeof inner !== "object" || Array.isArray(inner)) continue;

    const payload = inner as Record<string, unknown>;
    const rows = payload.results;

    if (Array.isArray(rows)) {
      for (const row of rows) {
        pushUniqueRecord(seen, flattened, row);
      }
    }

    const preview = payload.results_preview;

    if (Array.isArray(preview)) {
      for (const row of preview) {
        pushUniqueRecord(seen, flattened, row);
      }
    }
  }

  return flattened;
}

export function extractGodsEyeResults(data: GodsEyeResponse | null): unknown[] {
  if (!data) return [];

  const unified = flattenGodsEyeUnifiedResults(data);

  if (unified.length > 0) {
    return unified;
  }

  const candidates = [
    data.results,
    data.hits,
    data.records,
    data.data,
    data.items,
    data.matches,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((entry) => tagIntelRecord(entry));
    }
  }

  const nested = data.data;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = (nested as Record<string, unknown>).results;

    if (Array.isArray(inner)) {
      return inner.map((entry) => tagIntelRecord(entry));
    }
  }

  if (data.success === true && data.result && typeof data.result === "object") {
    return [tagIntelRecord(data.result)];
  }

  return [];
}

export function sanitizeGodsEyeSearch(
  data: GodsEyeResponse | null,
): SanitizedBreachResponse {
  if (!data) return { count: 0, results: [] };

  const results = extractGodsEyeResults(data);
  const count =
    typeof data.count === "number"
      ? data.count
      : typeof data.total === "number"
        ? data.total
        : results.length;

  return { count, results };
}

export async function fetchGodsEyeSearch(
  searchType: GodsEyeSearchType,
  query: string,
  timeoutMs = 30_000,
): Promise<GodsEyeResponse> {
  const apiKey = getGodsEyeApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/v1/public/search`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchType, query: query.trim() }),
    cache: "no-store",
    timeoutMs,
  });

  const data = await parseGodsEyeJson(res);

  if (!res.ok) {
    throw new Error(
      sanitizeGodsEyeUserError(
        String(data.error || data.message || "Search failed"),
      ),
    );
  }

  return data;
}

export async function fetchGodsEyeSearchSafe(
  searchType: GodsEyeSearchType,
  query: string,
  options?: { timeoutMs?: number },
): Promise<GodsEyeResponse | null> {
  if (!getGodsEyeApiKey()) return null;

  try {
    return await fetchGodsEyeSearch(
      searchType,
      query,
      options?.timeoutMs ?? 30_000,
    );
  } catch {
    return null;
  }
}

export async function fetchGodsEyeFivem(
  kind: "accounts" | "bans",
  discordId: string,
): Promise<GodsEyeResponse | null> {
  const result = await fetchGodsEyeFivemDetailed(kind, discordId);
  return result.ok ? result.data : null;
}

export type GodsEyeCallResult = {
  ok: boolean;
  status: number;
  data: GodsEyeResponse | null;
  error?: string;
  code?: string;
};

export async function fetchGodsEyeFivemDetailed(
  kind: "accounts" | "bans",
  discordId: string,
): Promise<GodsEyeCallResult> {
  const apiKey = getGodsEyeApiKey();

  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: publicServiceUnavailable(),
      code: "MISSING_KEY",
    };
  }

  try {
    const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/v1/public/fivem`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kind, discordId: discordId.trim() }),
      cache: "no-store",
      timeoutMs: 30_000,
    });

    const data = await parseGodsEyeJson(res);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: String(data.error || data.message || "FiveM lookup failed"),
        code: typeof data.code === "string" ? data.code : undefined,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "FiveM lookup failed",
    };
  }
}

export async function fetchGodsEyeEmailReport(
  email: string,
): Promise<GodsEyeResponse | null> {
  const apiKey = getGodsEyeApiKey();

  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/v1/email-report`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
      cache: "no-store",
      timeoutMs: 30_000,
    });

    const data = await parseGodsEyeJson(res);

    if (!res.ok) {
      throw new Error(String(data.error || publicSearchError()));
    }

    return data;
  } catch {
    return null;
  }
}

export async function fetchGodsEyeGeolocate(
  payload: { image?: string; ip?: string },
): Promise<GodsEyeResponse | null> {
  const apiKey = getGodsEyeApiKey();

  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/v1/geolocate`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      timeoutMs: 30_000,
    });

    const data = await parseGodsEyeJson(res);

    if (!res.ok) {
      throw new Error(String(data.error || publicSearchError()));
    }

    return data;
  } catch {
    return null;
  }
}

export async function fetchGodsEyeIngressCheck(): Promise<GodsEyeResponse | null> {
  const apiKey = getGodsEyeApiKey();

  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/ingress-check`, {
      headers: authHeaders(apiKey),
      cache: "no-store",
      timeoutMs: 15_000,
    });

    return parseGodsEyeJson(res);
  } catch {
    return null;
  }
}

export async function fetchGodsEyeRawExport(
  storageId: string,
  bucket = "leaks.public",
): Promise<{ content: string; error?: string }> {
  const apiKey = getGodsEyeExportApiKey();

  if (!apiKey) {
    return { content: "", error: publicServiceUnavailable() };
  }

  try {
    const res = await fetchWithTimeout(`${GODSEYE_BASE}/api/v1/raw-export`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Same shape as csint.pro /api/intelx: storageid + bucket.
      body: JSON.stringify({ storageid: storageId.trim(), bucket }),
      cache: "no-store",
      timeoutMs: 60_000,
    });

    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("text/plain")) {
      return { content: sanitizePublicContent(await res.text()) };
    }

    const data = await parseGodsEyeJson(res);

    if (!res.ok) {
      return {
        content: "",
        error: sanitizePublicText(String(data.error || publicSearchError())),
      };
    }

    return { content: sanitizePublicContent(JSON.stringify(data, null, 2)) };
  } catch (err) {
    return {
      content: "",
      error: sanitizePublicText(
        err instanceof Error ? err.message : publicSearchError(),
      ),
    };
  }
}
