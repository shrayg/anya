/**
 * Shared residential proxy for OSINT probes that get datacenter-blocked
 * (Snapchat, TikTok, Facebook, Instagram signup checks, etc.).
 *
 * Prefer OSINT_RESIDENTIAL_PROXY_URL; falls back to INSTAGRAM_PROXY_URL so the
 * existing VPS Instagram proxy is reused without duplicating secrets.
 */

import { existsSync, readFileSync } from "node:fs";

import { ProxyAgent } from "undici";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const proxyDispatcherCache = new Map<string, ProxyAgent>();

function loadProxyFromSecretsFile(): string | null {
  const path =
    process.env.ANYA_INSTAGRAM_SECRETS_PATH?.trim() ||
    "/var/www/anya-secrets/instagram.env";

  try {
    if (!existsSync(path)) return null;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();

      if (key !== "INSTAGRAM_PROXY_URL" && key !== "OSINT_RESIDENTIAL_PROXY_URL") {
        continue;
      }

      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value) return value;
    }
  } catch {
    return null;
  }

  return null;
}

export function getResidentialProxyUrl(): string | null {
  const url =
    process.env.OSINT_RESIDENTIAL_PROXY_URL?.trim() ||
    process.env.INSTAGRAM_PROXY_URL?.trim() ||
    loadProxyFromSecretsFile();

  return url || null;
}

export function isResidentialProxyConfigured(): boolean {
  return Boolean(getResidentialProxyUrl());
}

export function getResidentialProxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = getResidentialProxyUrl();

  if (!proxyUrl) return undefined;

  let dispatcher = proxyDispatcherCache.get(proxyUrl);

  if (!dispatcher) {
    dispatcher = new ProxyAgent(proxyUrl);
    proxyDispatcherCache.set(proxyUrl, dispatcher);
  }

  return dispatcher;
}

export function residentialProxyHostLabel(): string | null {
  const proxyUrl = getResidentialProxyUrl();

  if (!proxyUrl) return null;

  try {
    return new URL(proxyUrl).host;
  } catch {
    return "configured";
  }
}

/** Fetch via residential proxy when configured; otherwise direct. */
export async function fetchWithResidentialProxy(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number; forceProxy?: boolean },
): Promise<Response> {
  const { forceProxy, ...rest } = init ?? {};
  const dispatcher = getResidentialProxyDispatcher();

  if (forceProxy && !dispatcher) {
    throw new Error(
      "Residential proxy is not configured. Set OSINT_RESIDENTIAL_PROXY_URL or INSTAGRAM_PROXY_URL.",
    );
  }

  return fetchWithTimeout(input, {
    ...rest,
    dispatcher,
  });
}
