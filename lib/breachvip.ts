import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { CombCredential } from "@/lib/proxynova-comb";

const BREACHVIP_SEARCH_URL = "https://breach.vip/api/search";
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_RESULT_ROWS = 200;

/** Free BreachVIP index is on by default. Set BREACH_VIP_ENABLED=false to disable. */
export function isBreachVipEnabled(): boolean {
  return process.env.BREACH_VIP_ENABLED !== "false";
}

export type BreachVipField =
  | "email"
  | "password"
  | "domain"
  | "username"
  | "ip"
  | "name"
  | "uuid"
  | "steamid"
  | "phone"
  | "discordid";

export type BreachVipSearchOptions = {
  fields?: BreachVipField[];
  categories?: string[] | null;
  wildcard?: boolean;
  caseSensitive?: boolean;
  timeoutMs?: number;
  maxRows?: number;
};

export type BreachVipRecord = Record<string, unknown>;

export type BreachVipSearchResult = {
  source: string;
  query: string;
  totalMatches: number;
  returned: number;
  results: BreachVipRecord[];
  credentials: CombCredential[];
};

export function sanitizeBreachVipUserError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("rate") &&
    (lower.includes("limit") || lower.includes("429"))
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }

  const cleaned = sanitizePublicText(message).trim();
  return cleaned || publicSearchError();
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function firstString(
  record: BreachVipRecord,
  keys: string[],
): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

/** Map a BreachVIP hit into the Comb credential shape used by the Breaches UI. */
export function breachVipRecordToCredential(
  record: BreachVipRecord,
): CombCredential | null {
  const identifier = firstString(record, [
    "email",
    "username",
    "name",
    "phone",
    "domain",
    "ip",
    "discordid",
    "steamid",
    "uuid",
  ]);
  const secret = firstString(record, ["password", "pass", "hash"]);
  const breachSource = firstString(record, ["source", "breach", "database"]);

  if (!identifier && !secret) return null;

  const id = identifier || "(unknown)";
  const raw = secret ? `${id}:${secret}` : id;

  return {
    identifier: id,
    secret,
    raw: breachSource ? `${breachSource} · ${raw}` : raw,
  };
}

export function breachVipResultsToCredentials(
  results: BreachVipRecord[],
): CombCredential[] {
  const credentials: CombCredential[] = [];
  const seen = new Set<string>();

  for (const record of results) {
    const cred = breachVipRecordToCredential(record);
    if (!cred) continue;

    const key = `${cred.identifier.toLowerCase()}\0${cred.secret}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credentials.push(cred);
  }

  return credentials;
}

function extractResults(payload: unknown): BreachVipRecord[] {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;

  if (Array.isArray(data.results)) {
    return data.results.filter(
      (row): row is BreachVipRecord =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  }

  if (Array.isArray(data.data)) {
    return data.data.filter(
      (row): row is BreachVipRecord =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  }

  return [];
}

/**
 * Unauthenticated free search against BreachVIP.
 * Community clients report ~15 requests/minute; handle 429 gracefully.
 */
export async function searchBreachVip(
  term: string,
  options?: BreachVipSearchOptions,
): Promise<BreachVipSearchResult> {
  if (!isBreachVipEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const trimmed = term.trim();
  if (!trimmed) {
    throw new Error("Missing search term");
  }

  const fields = options?.fields?.length ? options.fields : (["email"] as BreachVipField[]);
  const maxRows = Math.min(
    Math.max(1, options?.maxRows ?? MAX_RESULT_ROWS),
    MAX_RESULT_ROWS,
  );

  const body: Record<string, unknown> = {
    term: trimmed,
    fields,
    wildcard: options?.wildcard ?? false,
    case_sensitive: options?.caseSensitive ?? false,
  };

  if (options?.categories && options.categories.length > 0) {
    body.categories = options.categories;
  }

  let res: Response;

  try {
    res = await fetchWithTimeout(BREACHVIP_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "AnyaInt/1.0",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (err) {
    throw new Error(
      sanitizeBreachVipUserError(
        err instanceof Error ? err.message : publicSearchError(),
      ),
    );
  }

  if (res.status === 429) {
    throw new Error(sanitizeBreachVipUserError("rate limit 429"));
  }

  if (!res.ok) {
    let detail = `Search returned ${res.status}`;
    try {
      const errJson = (await res.json()) as Record<string, unknown>;
      detail = String(errJson.error || errJson.message || detail);
    } catch {
      // ignore parse errors
    }
    throw new Error(sanitizeBreachVipUserError(detail));
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error(publicSearchError());
  }

  const allResults = extractResults(payload);
  const results = allResults.slice(0, maxRows);
  const credentials = breachVipResultsToCredentials(results);

  return {
    source: PUBLIC_INTEL_SOURCE,
    query: trimmed,
    totalMatches: allResults.length,
    returned: results.length,
    results,
    credentials,
  };
}

export async function searchBreachVipForEmail(
  email: string,
  options?: Omit<BreachVipSearchOptions, "fields">,
): Promise<BreachVipSearchResult | null> {
  if (!isBreachVipEnabled()) return null;

  try {
    return await searchBreachVip(email, {
      ...options,
      fields: ["email"],
    });
  } catch {
    return null;
  }
}

/** Lightweight probe for module health — treats HTTP 200/400 as reachable. */
export async function probeBreachVip(): Promise<boolean> {
  if (!isBreachVipEnabled()) return false;

  try {
    const res = await fetchWithTimeout(BREACHVIP_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "AnyaInt/1.0",
      },
      body: JSON.stringify({
        term: "healthcheck@example.com",
        fields: ["email"],
        wildcard: false,
        case_sensitive: false,
      }),
      cache: "no-store",
      timeoutMs: 8_000,
    });

    return res.ok || res.status === 400 || res.status === 429;
  } catch {
    return false;
  }
}
