/**
 * Shodan modular client — host / search / dns / honeyscore.
 *
 * Upstream: direct SHODAN_API_KEY or BreachHub /api/shodan/*;
 * host also falls back to CSINT via gateway-fallback.
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
import { isCsintEnabled } from "@/lib/csint";
import { fetchShodanHostWithFallback } from "@/lib/gateway-fallback";
import type { SanitizedBreachResponse } from "@/lib/osintcat";

export const SHODAN_ENDPOINTS = [
  "host",
  "search",
  "dns",
  "dns/resolve",
  "dns/reverse",
  "honeyscore",
] as const;

export type ShodanEndpoint = (typeof SHODAN_ENDPOINTS)[number];

const ENDPOINT_SET = new Set<string>(SHODAN_ENDPOINTS);
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export type ShodanSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: ShodanEndpoint;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function isShodanEndpoint(value: string): value is ShodanEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function normalizeShodanPath(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function getShodanApiKey(): string | undefined {
  return process.env.SHODAN_API_KEY?.trim() || undefined;
}

export function getShodanBaseUrl(): string {
  return (
    process.env.SHODAN_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectShodanKey(): boolean {
  return Boolean(getShodanApiKey());
}

export function isShodanEnabled(): boolean {
  if (process.env.SHODAN_ENABLED === "false") return false;

  return (
    hasDirectShodanKey() || isBreachHubEnabled() || isCsintEnabled()
  );
}

export function buildShodanParams(
  endpoint: ShodanEndpoint,
  input: Record<string, string>,
): { params: Record<string, string>; queryLabel: string } | null {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = input[key]?.trim();

      if (value) return value;
    }

    return "";
  };

  switch (endpoint) {
    case "host":
    case "honeyscore": {
      const ip = pick("ip", "query");

      return ip ? { params: { ip }, queryLabel: ip } : null;
    }
    case "search": {
      const query = pick("query", "q");

      return query ? { params: { query }, queryLabel: query } : null;
    }
    case "dns": {
      const domain = pick("domain", "query");

      if (!domain) return null;
      const params: Record<string, string> = { domain };
      const type = pick("type");
      const history = pick("history");

      if (type) params.type = type;
      if (history) params.history = history;

      return { params, queryLabel: domain };
    }
    case "dns/resolve": {
      const hostnames = pick("hostnames", "hostname", "domain", "query");

      return hostnames
        ? { params: { hostnames }, queryLabel: hostnames }
        : null;
    }
    case "dns/reverse": {
      const ips = pick("ips", "ip", "query");

      return ips ? { params: { ips }, queryLabel: ips } : null;
    }
    default:
      return null;
  }
}

export async function fetchShodanSanitized(
  endpoint: ShodanEndpoint,
  input: Record<string, string>,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<ShodanSearchResult> {
  const built = buildShodanParams(endpoint, input);

  if (!built) {
    return {
      count: 0,
      results: [],
      query: "",
      endpoint,
      source: "breachhub",
    };
  }

  if (endpoint === "host") {
    const ip = built.queryLabel;

    if (!IPV4_RE.test(ip) && !ip.includes(":")) {
      throw new Error("Enter an IPv4 or IPv6 address.");
    }

    // Prefer shared BH → CSINT host fallback (never parallel).
    if (isBreachHubEnabled() || isCsintEnabled()) {
      const data = await fetchShodanHostWithFallback(ip);
      const sanitized = rowsFromBhPayload(data, ip);

      return {
        ...sanitized,
        query: ip,
        endpoint,
        source: "breachhub",
        raw: data,
      };
    }
  }

  const { data, source } = await fetchBhMirroredGet({
    gateway: "shodan",
    path: `/api/shodan/${endpoint}`,
    params: built.params,
    directKey: getShodanApiKey(),
    directBaseUrl: getShodanBaseUrl(),
    enabled: isShodanEnabled(),
    timeoutMs,
  });

  return {
    ...rowsFromBhPayload(data, built.queryLabel),
    query: built.queryLabel,
    endpoint,
    source,
    raw: data,
  };
}
