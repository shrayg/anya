/**
 * NBRS Roblox lookup client.
 *
 * Upstream: direct NBRS_API_KEY or BreachHub GET /api/nbrs/roblox.
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

export type NbrsSearchResult = SanitizedBreachResponse & {
  query: string;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function getNbrsApiKey(): string | undefined {
  return process.env.NBRS_API_KEY?.trim() || undefined;
}

export function getNbrsBaseUrl(): string {
  return (process.env.NBRS_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE).replace(
    /\/$/,
    "",
  );
}

export function hasDirectNbrsKey(): boolean {
  return Boolean(getNbrsApiKey());
}

export function isNbrsEnabled(): boolean {
  if (process.env.NBRS_ENABLED === "false") return false;
  return hasDirectNbrsKey() || isBreachHubEnabled();
}

export function buildNbrsParams(query: string): Record<string, string> {
  const cleaned = query.trim().replace(/^@/, "");
  if (!cleaned) return {};
  return /^\d+$/.test(cleaned)
    ? { playerid: cleaned }
    : { username: cleaned };
}

export async function fetchNbrsRobloxSanitized(
  query: string,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<NbrsSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { count: 0, results: [], query: trimmed, source: "breachhub" };
  }
  const params = buildNbrsParams(trimmed);
  const { data, source } = await fetchBhMirroredGet({
    gateway: "nbrs",
    path: "/api/nbrs/roblox",
    params,
    directKey: getNbrsApiKey(),
    directBaseUrl: getNbrsBaseUrl(),
    enabled: isNbrsEnabled(),
    timeoutMs,
  });
  return {
    ...rowsFromBhPayload(data, trimmed),
    query: trimmed,
    source,
    raw: data,
  };
}
