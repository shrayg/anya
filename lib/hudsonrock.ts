/**
 * Hudson Rock (Cavalier) stealer / infection intelligence client.
 *
 * Upstream: direct HUDSONROCK_API_KEY or BreachHub GET /api/hudsonrock/*.
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

export const HUDSONROCK_ENDPOINTS = [
  "search-by-domain",
  "search-by-domain/overview",
  "search-by-domain/assessment",
  "search-by-domain/discovery",
  "search-by-login/emails",
  "search-by-login/usernames",
  "search-by-ip",
  "search-by-keyword",
  "search-by-keyword/urls",
  "search-by-stealer/infection-analysis",
] as const;

export type HudsonRockEndpoint = (typeof HUDSONROCK_ENDPOINTS)[number];

const ENDPOINT_SET = new Set<string>(HUDSONROCK_ENDPOINTS);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type HudsonRockSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: HudsonRockEndpoint;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function isHudsonRockEndpoint(
  value: string,
): value is HudsonRockEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function normalizeHudsonRockPath(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function getHudsonRockApiKey(): string | undefined {
  return (
    process.env.HUDSONROCK_API_KEY?.trim() ||
    process.env.HUDSON_ROCK_API_KEY?.trim() ||
    undefined
  );
}

export function getHudsonRockBaseUrl(): string {
  return (
    process.env.HUDSONROCK_BASE_URL?.trim() ||
    process.env.HUDSON_ROCK_BASE_URL?.trim() ||
    BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectHudsonRockKey(): boolean {
  return Boolean(getHudsonRockApiKey());
}

export function isHudsonRockEnabled(): boolean {
  if (
    process.env.HUDSONROCK_ENABLED === "false" ||
    process.env.HUDSON_ROCK_ENABLED === "false"
  ) {
    return false;
  }

  return hasDirectHudsonRockKey() || isBreachHubEnabled();
}

export function hudsonRockModuleSlugForEndpoint(
  endpoint: HudsonRockEndpoint,
): string {
  if (endpoint.includes("domain")) return "domains";
  if (endpoint.includes("ip")) return "ip";
  if (endpoint.includes("stealer")) return "stealer-logs";

  return "stealer-logs";
}

export function buildHudsonRockParams(
  endpoint: HudsonRockEndpoint,
  input: Record<string, string>,
): Record<string, string> | null {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = input[key]?.trim();

      if (value) return value;
    }

    return "";
  };

  switch (endpoint) {
    case "search-by-domain":
    case "search-by-domain/overview":
    case "search-by-domain/assessment":
    case "search-by-domain/discovery": {
      const domain = pick("domain", "query");

      return domain ? { domain } : null;
    }
    case "search-by-login/emails": {
      const email = pick("email", "query");

      return email ? { email } : null;
    }
    case "search-by-login/usernames": {
      const username = pick("username", "query");

      return username ? { username } : null;
    }
    case "search-by-ip": {
      const ip = pick("ip", "query");
      const cidr = pick("cidr");

      if (!ip && !cidr) return null;
      const out: Record<string, string> = {};

      if (ip) out.ip = ip;
      if (cidr) out.cidr = cidr;

      return out;
    }
    case "search-by-keyword":
    case "search-by-keyword/urls": {
      const keyword = pick("keyword", "query");

      return keyword ? { keyword } : null;
    }
    case "search-by-stealer/infection-analysis": {
      const stealer = pick("stealer", "query", "name");

      return stealer ? { stealer } : null;
    }
    default:
      return null;
  }
}

/** Infer endpoint from free-form query when UI omits a specific tool. */
export function detectHudsonRockEndpoint(
  query: string,
): HudsonRockEndpoint {
  const q = query.trim();

  if (EMAIL_RE.test(q)) return "search-by-login/emails";
  if (IPV4_RE.test(q) || q.includes(":")) return "search-by-ip";
  if (DOMAIN_RE.test(q)) return "search-by-domain";

  return "search-by-keyword";
}

export async function fetchHudsonRockSanitized(
  endpoint: HudsonRockEndpoint,
  input: Record<string, string>,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<HudsonRockSearchResult> {
  const params = buildHudsonRockParams(endpoint, input);
  const queryLabel =
    params?.domain ||
    params?.email ||
    params?.username ||
    params?.ip ||
    params?.cidr ||
    params?.keyword ||
    params?.stealer ||
    input.query ||
    "";

  if (!params || !queryLabel) {
    return {
      count: 0,
      results: [],
      query: queryLabel,
      endpoint,
      source: "breachhub",
    };
  }

  const { data, source } = await fetchBhMirroredGet({
    gateway: "hudsonrock",
    path: `/api/hudsonrock/${endpoint}`,
    params,
    directKey: getHudsonRockApiKey(),
    directBaseUrl: getHudsonRockBaseUrl(),
    enabled: isHudsonRockEnabled(),
    timeoutMs,
  });

  return {
    ...rowsFromBhPayload(data, queryLabel),
    query: queryLabel,
    endpoint,
    source,
    raw: data,
  };
}
