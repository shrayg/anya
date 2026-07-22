/**
 * LeakSight breach / leak lookup client.
 *
 * Upstream: direct LEAKSIGHT_API_KEY or BreachHub GET /api/leaksight.
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

export const LEAKSIGHT_TYPES = [
  "email",
  "username",
  "password",
  "number",
  "ip",
  "subdomainsearch",
  "url",
  "hwid",
  "searchstring",
] as const;

export type LeaksightType = (typeof LEAKSIGHT_TYPES)[number];

const TYPE_SET = new Set<string>(LEAKSIGHT_TYPES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
const URL_RE = /^https?:\/\//i;

export type LeaksightSearchResult = SanitizedBreachResponse & {
  query: string;
  type: LeaksightType;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function isLeaksightType(value: string): value is LeaksightType {
  return TYPE_SET.has(value.trim().toLowerCase());
}

export function getLeaksightApiKey(): string | undefined {
  return process.env.LEAKSIGHT_API_KEY?.trim() || undefined;
}

export function getLeaksightBaseUrl(): string {
  return (
    process.env.LEAKSIGHT_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectLeaksightKey(): boolean {
  return Boolean(getLeaksightApiKey());
}

export function isLeaksightEnabled(): boolean {
  if (process.env.LEAKSIGHT_ENABLED === "false") return false;
  return hasDirectLeaksightKey() || isBreachHubEnabled();
}

export function detectLeaksightType(
  query: string,
  hint?: string | null,
): LeaksightType {
  const h = (hint || "").trim().toLowerCase();
  if (isLeaksightType(h)) return h;
  const aliases: Record<string, LeaksightType> = {
    phone: "number",
    domain: "subdomainsearch",
    subdomain: "subdomainsearch",
  };
  if (aliases[h]) return aliases[h];
  const q = query.trim();
  if (EMAIL_RE.test(q)) return "email";
  if (URL_RE.test(q)) return "url";
  if (IPV4_RE.test(q)) return "ip";
  if (PHONE_RE.test(q) && q.replace(/\D/g, "").length >= 7) return "number";
  if (DOMAIN_RE.test(q)) return "subdomainsearch";
  return "username";
}

export async function fetchLeaksightSanitized(
  query: string,
  typeHint?: string | null,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<LeaksightSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      count: 0,
      results: [],
      query: trimmed,
      type: "email",
      source: "breachhub",
    };
  }
  const type = detectLeaksightType(trimmed, typeHint);
  const { data, source } = await fetchBhMirroredGet({
    gateway: "leaksight",
    path: "/api/leaksight",
    params: { type, query: trimmed },
    directKey: getLeaksightApiKey(),
    directBaseUrl: getLeaksightBaseUrl(),
    enabled: isLeaksightEnabled(),
    timeoutMs,
  });
  return {
    ...rowsFromBhPayload(data, trimmed),
    query: trimmed,
    type,
    source,
    raw: data,
  };
}
