/**
 * Binlist BIN lookup client.
 *
 * Upstream priority:
 * 1. Direct BINLIST_API_KEY / BreachHub GET /api/binlist
 * 2. Public lookup.binlist.net (no key)
 *
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
import { lookupBin, normalizeBin } from "@/lib/bin-lookup";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { recordProviderRequest } from "@/lib/provider-request-log";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

export type BinlistSearchResult = SanitizedBreachResponse & {
  query: string;
  bin: string;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function getBinlistApiKey(): string | undefined {
  return process.env.BINLIST_API_KEY?.trim() || undefined;
}

export function getBinlistBaseUrl(): string {
  return (
    process.env.BINLIST_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectBinlistKey(): boolean {
  return Boolean(getBinlistApiKey());
}

export function isBinlistEnabled(): boolean {
  if (process.env.BINLIST_ENABLED === "false") return false;

  return true;
}

async function fetchPublicBinlist(
  bin: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const started = Date.now();

  try {
    const res = await fetchWithTimeout(`https://lookup.binlist.net/${bin}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Version": "3",
        "User-Agent": "AnyaInt-Binlist/1.0",
      },
      cache: "no-store",
      timeoutMs,
    });
    const text = await readResponseText(
      res,
      Math.max(2_000, timeoutMs - (Date.now() - started)),
    );

    if (res.status === 404) {
      recordProviderRequest({
        gateway: "binlist",
        path: "/lookup",
        method: "GET",
        ok: true,
        latencyMs: Date.now() - started,
        statusCode: 404,
      });

      return {};
    }

    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "BIN lookup rate limit reached. Try again in a minute."
          : publicSearchError(),
      );
    }

    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    recordProviderRequest({
      gateway: "binlist",
      path: "/lookup",
      method: "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: "binlist",
      path: "/lookup",
      method: "GET",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err;
  }
}

export async function fetchBinlistSanitized(
  query: string,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<BinlistSearchResult> {
  const bin = normalizeBin(query);

  if (!bin) {
    throw new Error("Enter the first 6–8 digits of a card number (BIN).");
  }

  if (hasDirectBinlistKey() || isBreachHubEnabled()) {
    try {
      const { data, source } = await fetchBhMirroredGet({
        gateway: "binlist",
        path: "/api/binlist",
        params: { bin },
        directKey: getBinlistApiKey(),
        directBaseUrl: getBinlistBaseUrl(),
        enabled: true,
        timeoutMs,
      });
      const sanitized = rowsFromBhPayload(data, bin);

      if (sanitized.count > 0) {
        return {
          ...sanitized,
          query: bin,
          bin,
          source,
          raw: data,
        };
      }
    } catch {
      // Fall through to public binlist.net
    }
  }

  try {
    const publicData = await fetchPublicBinlist(bin, timeoutMs);
    const mapped = await lookupBin(bin).catch(() => null);
    const row = mapped
      ? { ...mapped, ...(Object.keys(publicData).length ? publicData : {}) }
      : publicData;
    const results = rowsFromBhPayload(row, bin);

    return {
      ...results,
      query: bin,
      bin,
      source: "public",
      raw: row,
    };
  } catch (err) {
    if (!hasDirectBinlistKey() && !isBreachHubEnabled()) {
      throw err instanceof Error
        ? err
        : new Error(publicServiceUnavailable());
    }
    throw err;
  }
}
