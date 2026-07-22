/**
 * GitHub username / email OSINT client.
 *
 * Upstream priority:
 * 1. Direct GITHUB_API_KEY (+ optional GITHUB_BASE_URL) → BreachHub-compatible
 * 2. BreachHub GET /api/github
 * 3. Native api.github.com with GITHUB_TOKEN / GITHUB_API_TOKEN
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
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { recordProviderRequest } from "@/lib/provider-request-log";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type GithubSearchResult = SanitizedBreachResponse & {
  query: string;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function getGithubApiKey(): string | undefined {
  return process.env.GITHUB_API_KEY?.trim() || undefined;
}

export function getGithubNativeToken(): string | undefined {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_API_TOKEN?.trim() ||
    undefined
  );
}

export function getGithubBaseUrl(): string {
  return (
    process.env.GITHUB_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
}

export function hasDirectGithubKey(): boolean {
  return Boolean(getGithubApiKey());
}

export function isGithubEnabled(): boolean {
  if (process.env.GITHUB_ENABLED === "false") return false;

  return (
    hasDirectGithubKey() ||
    isBreachHubEnabled() ||
    Boolean(getGithubNativeToken())
  );
}

export function buildGithubParams(query: string): Record<string, string> {
  const trimmed = query.trim().replace(/^@/, "");

  if (!trimmed) return {};
  if (EMAIL_RE.test(trimmed)) return { email: trimmed };

  return { username: trimmed, query: trimmed };
}

async function fetchGithubNative(
  query: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const token = getGithubNativeToken();
  const trimmed = query.trim().replace(/^@/, "");
  const started = Date.now();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "AnyaInt-GitHub/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    let url: string;

    if (EMAIL_RE.test(trimmed)) {
      url = `https://api.github.com/search/users?q=${encodeURIComponent(trimmed)}+in:email&per_page=10`;
    } else {
      url = `https://api.github.com/users/${encodeURIComponent(trimmed)}`;
    }

    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers,
      cache: "no-store",
      timeoutMs,
    });
    const text = await readResponseText(
      res,
      Math.max(2_000, timeoutMs - (Date.now() - started)),
    );
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(
        res.ok
          ? publicSearchError("Invalid response from intelligence index.")
          : `HTTP ${res.status}`,
      );
    }

    if (!res.ok) {
      throw new Error(
        typeof data.message === "string" ? data.message : `HTTP ${res.status}`,
      );
    }

    recordProviderRequest({
      gateway: "github",
      path: EMAIL_RE.test(trimmed) ? "/search/users" : "/users",
      method: "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: "github",
      path: "/users",
      method: "GET",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err;
  }
}

export async function fetchGithubSanitized(
  query: string,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<GithubSearchResult> {
  const trimmed = query.trim().replace(/^@/, "");

  if (!trimmed) {
    return { count: 0, results: [], query: trimmed, source: "breachhub" };
  }

  if (hasDirectGithubKey() || isBreachHubEnabled()) {
    try {
      const { data, source } = await fetchBhMirroredGet({
        gateway: "github",
        path: "/api/github",
        params: buildGithubParams(trimmed),
        directKey: getGithubApiKey(),
        directBaseUrl: getGithubBaseUrl(),
        enabled: true,
        timeoutMs,
      });
      const sanitized = rowsFromBhPayload(data, trimmed);

      if (sanitized.count > 0) {
        return {
          ...sanitized,
          query: trimmed,
          source,
          raw: data,
        };
      }
    } catch {
      // Fall through to native GitHub when token present.
    }
  }

  if (!getGithubNativeToken()) {
    if (!hasDirectGithubKey() && !isBreachHubEnabled()) {
      throw new Error(publicServiceUnavailable());
    }

    return { count: 0, results: [], query: trimmed, source: "breachhub" };
  }

  const data = await fetchGithubNative(trimmed, timeoutMs);

  return {
    ...rowsFromBhPayload(data, trimmed),
    query: trimmed,
    source: "direct",
    raw: data,
  };
}
