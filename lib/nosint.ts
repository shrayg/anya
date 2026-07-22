/**
 * Nosint search / IP client.
 *
 * Upstream: direct NOSINT_API_KEY or BreachHub GET /api/nosint/*.
 * Server-only — do not import from client modules.
 */

import { isBreachHubEnabled } from "@/lib/breachhub";
import {
  BH_VENDOR_DEFAULT_BASE,
  BH_VENDOR_DEFAULT_TIMEOUT_MS,
  fetchBhMirroredGet,
  rowsFromBhPayload,
  type BhVendorSource,
} from "@/lib/bh-vendor-proxy";
import type { SanitizedBreachResponse } from "@/lib/osintcat";

export const NOSINT_ENDPOINTS = ["search", "ip"] as const;
export type NosintEndpoint = (typeof NOSINT_ENDPOINTS)[number];
export const NOSINT_SEARCH_TYPES = [
  "email",
  "username",
  "phone",
] as const;
export type NosintSearchType = (typeof NOSINT_SEARCH_TYPES)[number];

const ENDPOINT_SET = new Set<string>(NOSINT_ENDPOINTS);
const TYPE_SET = new Set<string>(NOSINT_SEARCH_TYPES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export type NosintSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: NosintEndpoint;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function isNosintEndpoint(value: string): value is NosintEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function isNosintSearchType(value: string): value is NosintSearchType {
  return TYPE_SET.has(value.trim().toLowerCase());
}

export function getNosintApiKey(): string | undefined {
  return process.env.NOSINT_API_KEY?.trim() || undefined;
}

export function getNosintBaseUrl(): string {
  return (
    process.env.NOSINT_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectNosintKey(): boolean {
  return Boolean(getNosintApiKey());
}

export function isNosintEnabled(): boolean {
  if (process.env.NOSINT_ENABLED === "false") return false;
  return hasDirectNosintKey() || isBreachHubEnabled();
}

export function detectNosintSearchType(
  query: string,
  hint?: string | null,
): NosintSearchType {
  const h = (hint || "").trim().toLowerCase();
  if (isNosintSearchType(h)) return h;
  const q = query.trim();
  if (EMAIL_RE.test(q)) return "email";
  if (PHONE_RE.test(q) && q.replace(/\D/g, "").length >= 7) return "phone";
  return "username";
}

export async function fetchNosintSanitized(
  endpoint: NosintEndpoint,
  query: string,
  typeHint?: string | null,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<NosintSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      endpoint,
      source: "breachhub",
    };
  }
  const params =
    endpoint === "ip"
      ? { ip: trimmed }
      : { query: trimmed, type: detectNosintSearchType(trimmed, typeHint) };
  if (endpoint === "ip" && !IPV4_RE.test(trimmed) && !trimmed.includes(":")) {
    throw new Error("Enter an IPv4 or IPv6 address.");
  }
  const { data, source } = await fetchBhMirroredGet({
    gateway: "nosint",
    path: `/api/nosint/${endpoint}`,
    params,
    directKey: getNosintApiKey(),
    directBaseUrl: getNosintBaseUrl(),
    enabled: isNosintEnabled(),
    timeoutMs,
  });
  return {
    ...rowsFromBhPayload(data, trimmed),
    query: trimmed,
    endpoint,
    source,
    raw: data,
  };
}
