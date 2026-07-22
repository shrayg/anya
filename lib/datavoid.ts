/**
 * DataVoid multi-module client (recovery, people, stealer, geo, social, gaming).
 *
 * Upstream: direct DATAVOID_API_KEY or BreachHub /api/datavoid/*.
 * GET endpoints use query params; geocode / reverse-geocode / instagram /
 * google-docs use POST (also accepted via GET query-string on the site route).
 * Server-only — do not import from client modules.
 */

import { isBreachHubEnabled } from "@/lib/breachhub";
import {
  BH_VENDOR_DEFAULT_BASE,
  BH_VENDOR_DEFAULT_TIMEOUT_MS,
  fetchBhMirroredGet,
  fetchBhMirroredPost,
  rowsFromBhPayload,
  type BhVendorSource,
} from "@/lib/bh-vendor-proxy";
import type { SanitizedBreachResponse } from "@/lib/osintcat";

export const DATAVOID_GET_ENDPOINTS = [
  "recovery",
  "us",
  "ca",
  "il",
  "stealer",
  "automotive",
  "automotive/check",
  "company",
  "discord",
  "twitter",
  "fivem",
  "roblox",
] as const;

export const DATAVOID_POST_ENDPOINTS = [
  "geocode",
  "reverse-geocode",
  "instagram",
  "google-docs",
] as const;

export const DATAVOID_ENDPOINTS = [
  ...DATAVOID_GET_ENDPOINTS,
  ...DATAVOID_POST_ENDPOINTS,
] as const;

export type DatavoidEndpoint = (typeof DATAVOID_ENDPOINTS)[number];
export type DatavoidHttpMethod = "GET" | "POST";

const ENDPOINT_SET = new Set<string>(DATAVOID_ENDPOINTS);
const POST_SET = new Set<string>(DATAVOID_POST_ENDPOINTS);

export type DatavoidSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: DatavoidEndpoint;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function isDatavoidEndpoint(value: string): value is DatavoidEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function normalizeDatavoidPath(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

export function datavoidMethodForEndpoint(
  endpoint: DatavoidEndpoint,
): DatavoidHttpMethod {
  return POST_SET.has(endpoint) ? "POST" : "GET";
}

export function getDatavoidApiKey(): string | undefined {
  return process.env.DATAVOID_API_KEY?.trim() || undefined;
}

export function getDatavoidBaseUrl(): string {
  return (
    process.env.DATAVOID_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectDatavoidKey(): boolean {
  return Boolean(getDatavoidApiKey());
}

export function isDatavoidEnabled(): boolean {
  if (process.env.DATAVOID_ENABLED === "false") return false;

  return hasDirectDatavoidKey() || isBreachHubEnabled();
}

export function datavoidModuleSlugForEndpoint(
  endpoint: DatavoidEndpoint,
): string {
  switch (endpoint) {
    case "stealer":
      return "stealer-logs";
    case "discord":
      return "discord-id";
    case "twitter":
      return "twitter";
    case "fivem":
      return "fivem";
    case "roblox":
      return "roblox";
    case "instagram":
      return "instagram";
    case "automotive":
    case "automotive/check":
      return "vin-decoder";
    case "geocode":
    case "reverse-geocode":
      return "ip";
    default:
      return "datavoid";
  }
}

export function buildDatavoidParams(
  endpoint: DatavoidEndpoint,
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
    case "recovery":
    case "us":
    case "ca":
    case "il":
    case "stealer":
    case "automotive":
    case "automotive/check":
    case "company":
    case "fivem":
    case "roblox": {
      const q = pick("q", "query", "term");

      return q ? { params: { q }, queryLabel: q } : null;
    }
    case "discord": {
      const id = pick("id", "discord_id", "query");

      return id ? { params: { id }, queryLabel: id } : null;
    }
    case "twitter": {
      const q = pick("q", "query", "username").replace(/^@/, "");

      return q ? { params: { q }, queryLabel: q } : null;
    }
    case "geocode": {
      const address = pick("address", "query", "q");

      return address ? { params: { address }, queryLabel: address } : null;
    }
    case "reverse-geocode": {
      const lat = pick("lat", "latitude");
      const lon = pick("lon", "lng", "longitude");
      const query = pick("query");

      if (lat && lon) {
        return {
          params: { lat, lon },
          queryLabel: `${lat},${lon}`,
        };
      }
      if (query) return { params: { query }, queryLabel: query };

      return null;
    }
    case "instagram": {
      const query = pick("query", "q", "username", "email");
      const field = pick("field") || (query.includes("@") ? "email" : "username");

      return query
        ? { params: { query, field }, queryLabel: query }
        : null;
    }
    case "google-docs": {
      const url = pick("url", "query", "q", "link");

      return url ? { params: { url }, queryLabel: url } : null;
    }
    default:
      return null;
  }
}

export async function fetchDatavoidSanitized(
  endpoint: DatavoidEndpoint,
  input: Record<string, string>,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<DatavoidSearchResult> {
  const built = buildDatavoidParams(endpoint, input);

  if (!built) {
    return {
      count: 0,
      results: [],
      query: "",
      endpoint,
      source: "breachhub",
    };
  }

  const method = datavoidMethodForEndpoint(endpoint);
  const path = `/api/datavoid/${endpoint}`;
  const result =
    method === "POST"
      ? await fetchBhMirroredPost({
          gateway: "datavoid",
          path,
          body: built.params,
          directKey: getDatavoidApiKey(),
          directBaseUrl: getDatavoidBaseUrl(),
          enabled: isDatavoidEnabled(),
          timeoutMs,
        })
      : await fetchBhMirroredGet({
          gateway: "datavoid",
          path,
          params: built.params,
          directKey: getDatavoidApiKey(),
          directBaseUrl: getDatavoidBaseUrl(),
          enabled: isDatavoidEnabled(),
          timeoutMs,
        });

  return {
    ...rowsFromBhPayload(result.data, built.queryLabel),
    query: built.queryLabel,
    endpoint,
    source: result.source,
    raw: result.data,
  };
}
