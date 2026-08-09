/**
 * Credential Index (Snusbase) client.
 *
 * Upstream priority (per provider-dedupe):
 * 1. Direct SNUSBASE_API_KEY → BreachHub-compatible GET /api/snusbase*
 * 2. BreachHub BREACHHUB_API_KEY → /api/snusbase*
 * 3. CSINT /snusbase/search (and hash-lookup) when BH misses / unavailable
 *
 * Server-only — do not import from client modules.
 */

import { isBreachHubEnabled } from "@/lib/breachhub";
import {
  BH_VENDOR_DEFAULT_TIMEOUT_MS,
  fetchBhMirroredGet,
  rowsFromBhPayload,
  type BhVendorSource,
} from "@/lib/bh-vendor-proxy";
import {
  fetchCsintHashLookup,
  fetchCsintSnusbaseSearch,
  isCsintEnabled,
  snusbaseTypesForCsint,
} from "@/lib/csint";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import {
  shouldSkipCsintSnusbase,
  withPrimaryFallback,
} from "@/lib/provider-dedupe";
import {
  getSnusbaseApiKey,
  getSnusbaseBaseUrl,
  hasSnusbaseDirect,
} from "@/lib/snusbase";

export const SNUSBASE_ENDPOINTS = [
  "search",
  "combo-lookup",
  "hash-lookup",
  "ip-whois",
] as const;

export type SnusbaseEndpoint = (typeof SNUSBASE_ENDPOINTS)[number];

const ENDPOINT_SET = new Set<string>(SNUSBASE_ENDPOINTS);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const HASH_RE = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i;

export type SnusbaseSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: SnusbaseEndpoint;
  type?: string;
  source: BhVendorSource;
};

export function isSnusbaseEndpoint(value: string): value is SnusbaseEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function normalizeSnusbasePath(parts: string[]): string {
  return parts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function isSnusbaseEnabled(): boolean {
  return hasSnusbaseDirect() || isBreachHubEnabled() || isCsintEnabled();
}

function detectQueryKind(
  query: string,
  hint?: string | null,
): string {
  const h = (hint || "").trim().toLowerCase();

  if (
    [
      "email",
      "username",
      "ip",
      "hash",
      "password",
      "phone",
      "name",
      "domain",
    ].includes(h)
  ) {
    return h;
  }

  const q = query.trim();

  if (EMAIL_RE.test(q)) return "email";
  if (IPV4_RE.test(q)) return "ip";
  if (HASH_RE.test(q)) return "hash";

  return "username";
}

function comboTypeFor(
  query: string,
  hint?: string | null,
): "email" | "username" | "password" {
  const h = (hint || "").trim().toLowerCase();

  if (h === "email" || h === "username" || h === "password") return h;
  if (EMAIL_RE.test(query.trim())) return "email";
  if (h === "password") return "password";

  return "username";
}

function hashTypeFor(
  query: string,
  hint?: string | null,
): "hash" | "password" {
  const h = (hint || "").trim().toLowerCase();

  if (h === "password") return "password";
  if (h === "hash" || HASH_RE.test(query.trim())) return "hash";

  return "hash";
}

function upstreamPath(endpoint: SnusbaseEndpoint): string {
  if (endpoint === "search") return "/api/snusbase";

  return `/api/snusbase/${endpoint}`;
}

function buildParams(
  endpoint: SnusbaseEndpoint,
  query: string,
  typeHint?: string | null,
): Record<string, string> {
  if (endpoint === "combo-lookup") {
    return { type: comboTypeFor(query, typeHint), query };
  }

  if (endpoint === "hash-lookup") {
    return { type: hashTypeFor(query, typeHint), query };
  }

  return { query };
}

async function fetchViaMirror(
  endpoint: SnusbaseEndpoint,
  query: string,
  typeHint: string | null | undefined,
  timeoutMs: number,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  return fetchBhMirroredGet({
    gateway: "snusbase",
    path: upstreamPath(endpoint),
    params: buildParams(endpoint, query, typeHint),
    directKey: getSnusbaseApiKey(),
    directBaseUrl: getSnusbaseBaseUrl(),
    enabled: hasSnusbaseDirect() || isBreachHubEnabled(),
    timeoutMs,
  });
}

async function fetchCsintFallback(
  endpoint: SnusbaseEndpoint,
  query: string,
  typeHint?: string | null,
): Promise<SanitizedBreachResponse | null> {
  // Native SNUSBASE_API_KEY owns the vendor — skip CSINT mirrors.
  if (!isCsintEnabled() || shouldSkipCsintSnusbase()) return null;

  if (endpoint === "hash-lookup") {
    return fetchCsintHashLookup(query);
  }

  if (endpoint === "search") {
    const kind = detectQueryKind(query, typeHint);
    const types = snusbaseTypesForCsint(kind);

    return fetchCsintSnusbaseSearch(query, types);
  }

  // combo-lookup / ip-whois — CSINT has no dedicated mirrors.
  return null;
}

/**
 * Sanitized Credential Index / Snusbase specialty lookup.
 */
export async function fetchSnusbaseSanitized(
  endpoint: SnusbaseEndpoint,
  query: string,
  typeHint?: string | null,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<SnusbaseSearchResult> {
  const trimmed = query.trim();
  const kind = detectQueryKind(trimmed, typeHint);
  const type =
    endpoint === "combo-lookup"
      ? comboTypeFor(trimmed, typeHint)
      : endpoint === "hash-lookup"
        ? hashTypeFor(trimmed, typeHint)
        : kind;

  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      endpoint,
      type,
      source: "breachhub",
    };
  }

  if (!isSnusbaseEnabled()) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      endpoint,
      type,
      source: "breachhub",
    };
  }

  type GateResult = SanitizedBreachResponse & { source: BhVendorSource };

  const { value, used } = await withPrimaryFallback<GateResult>(
    async () => {
      if (!hasSnusbaseDirect() && !isBreachHubEnabled()) return null;

      try {
        const { data, source } = await fetchViaMirror(
          endpoint,
          trimmed,
          typeHint,
          timeoutMs,
        );
        const sanitized = rowsFromBhPayload(data, trimmed);

        return { ...sanitized, source };
      } catch {
        return null;
      }
    },
    async () => {
      const csint = await fetchCsintFallback(endpoint, trimmed, typeHint);

      if (!csint) return null;

      return { ...csint, source: "csint" };
    },
    (row) => Boolean(row && row.count > 0),
  );

  if (value) {
    return {
      count: value.count,
      results: value.results,
      query: trimmed,
      endpoint,
      type,
      source: value.source,
    };
  }

  // Soft-empty when gateways ran but found nothing (or CSINT unsupported).
  if (
    used !== "none" ||
    hasSnusbaseDirect() ||
    isBreachHubEnabled() ||
    (endpoint === "search" || endpoint === "hash-lookup"
      ? isCsintEnabled()
      : false)
  ) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      endpoint,
      type,
      source: "breachhub",
    };
  }

  return {
    count: 0,
    results: [],
    query: trimmed,
    endpoint,
    type,
    source: "breachhub",
  };
}
