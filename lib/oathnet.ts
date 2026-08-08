/**
 * OathNet specialty client — native oathnet.org + BreachHub `/api/oathnet/*`.
 *
 * Docs (source of truth): https://docs.oathnet.org/
 * - Base URL: `https://oathnet.org/api` (`OATHNET_BASE_URL`)
 * - Auth: lowercase `x-api-key` header (`OATHNET_API_KEY`)
 * - Prefer `/service/v2/*` for breach / stealer / victims; `/service/*` for OSINT
 *
 * Product gate: dedicated dashboard module + `/api/oathnet/*` are Ultimate /
 * Enterprise only. BreachHub-billed enrichment inside other modules may still
 * call BH mirrors when `BREACHHUB_API_KEY` is set.
 *
 * Upstream priority when both keys exist:
 * 1. Direct `OATHNET_API_KEY` → oathnet.org
 * 2. BreachHub mirror `/api/oathnet/*`
 * 3. CSINT for discord-to-roblox only (legacy path; not in current OpenAPI)
 *
 * Server-only — do not import from client modules.
 */

import { isBreachHubEnabled } from "@/lib/breachhub";
import {
  BH_VENDOR_DEFAULT_TIMEOUT_MS,
  fetchBhMirroredGet,
  rowsFromBhPayload,
  sanitizeBhVendorError,
  type BhVendorSource,
} from "@/lib/bh-vendor-proxy";
import {
  fetchCsintOathnetDiscordToRoblox,
  isCsintEnabled,
} from "@/lib/csint";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";
import { recordProviderRequest } from "@/lib/provider-request-log";
import { planHasUltimateModules, type PlanId } from "@/lib/plans";

export const OATHNET_STATIC_ENDPOINTS = [
  "breach",
  "stealer",
  "stealer-subdomain",
  "extract-subdomain",
  "victims",
  "discord-to-roblox",
  "discord-userinfo",
  "discord-username-history",
  "steam",
  "xbox",
  "roblox-userinfo",
  "mc-history",
  "ip-info",
  "holehe",
  "ghunt",
] as const;

export type OathnetStaticEndpoint = (typeof OATHNET_STATIC_ENDPOINTS)[number];

export type OathnetResolved =
  | { kind: "static"; endpoint: OathnetStaticEndpoint }
  | { kind: "victims-log"; logId: string }
  | { kind: "victims-file"; logId: string; fileId: string }
  | { kind: "victims-archive"; logId: string };

const STATIC_SET = new Set<string>(OATHNET_STATIC_ENDPOINTS);

/** Native OathNet production API root (OpenAPI `servers[0].url`). */
export const OATHNET_NATIVE_BASE_URL = "https://oathnet.org/api";

export type OathnetSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: string;
  source: BhVendorSource;
  raw?: Record<string, unknown>;
};

export function getOathnetApiKey(): string | undefined {
  return process.env.OATHNET_API_KEY?.trim() || undefined;
}

export function getOathnetBaseUrl(): string {
  const configured = process.env.OATHNET_BASE_URL?.trim();

  if (configured) return configured.replace(/\/$/, "");

  // Direct key → native host; otherwise BreachHub-compatible paths.
  return hasDirectOathnetKey()
    ? OATHNET_NATIVE_BASE_URL
    : "https://breachhub.org";
}

export function hasDirectOathnetKey(): boolean {
  return Boolean(getOathnetApiKey());
}

export function isOathnetEnabled(): boolean {
  if (process.env.OATHNET_ENABLED === "false") return false;

  return (
    hasDirectOathnetKey() || isBreachHubEnabled() || isCsintEnabled()
  );
}

/** Native / dedicated OathNet contribution — Ultimate or Enterprise only. */
export function canContributeOathnet(plan: PlanId | null | undefined): boolean {
  if (!plan) return false;

  return planHasUltimateModules(plan) && isOathnetEnabled();
}

export function resolveOathnetPath(parts: string[]): OathnetResolved | null {
  const segs = parts.map((p) => p.trim()).filter(Boolean);

  if (segs.length === 0) return null;

  const head = segs[0].toLowerCase();

  if (segs.length === 1 && STATIC_SET.has(head)) {
    return { kind: "static", endpoint: head as OathnetStaticEndpoint };
  }

  if (head === "victims" && segs.length === 2) {
    return { kind: "victims-log", logId: segs[1] };
  }

  if (
    head === "victims" &&
    segs.length === 4 &&
    segs[2].toLowerCase() === "files"
  ) {
    return { kind: "victims-file", logId: segs[1], fileId: segs[3] };
  }

  if (
    head === "victims" &&
    segs.length === 3 &&
    segs[2].toLowerCase() === "archive"
  ) {
    return { kind: "victims-archive", logId: segs[1] };
  }

  return null;
}

export function oathnetModuleSlug(resolved: OathnetResolved): string {
  if (resolved.kind !== "static") return "stealer-logs";

  switch (resolved.endpoint) {
    case "discord-to-roblox":
    case "discord-userinfo":
    case "discord-username-history":
      return "discord-id";
    case "roblox-userinfo":
      return "roblox";
    case "steam":
      return "steam";
    case "xbox":
      return "xbox";
    case "mc-history":
      return "minecraft";
    case "ip-info":
      return "ip";
    case "extract-subdomain":
      return "domain";
    case "holehe":
    case "ghunt":
      return "username";
    case "breach":
      return "breaches";
    default:
      return "stealer-logs";
  }
}

export function buildOathnetParams(
  resolved: OathnetResolved,
  input: Record<string, string>,
): {
  path: string;
  params: Record<string, string>;
  pathParams?: Record<string, string>;
  queryLabel: string;
} | null {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = input[key]?.trim();

      if (value) return value;
    }

    return "";
  };

  if (resolved.kind === "victims-log") {
    return {
      path: "/api/oathnet/victims/:log_id",
      params: {},
      pathParams: { log_id: resolved.logId },
      queryLabel: resolved.logId,
    };
  }

  if (resolved.kind === "victims-file") {
    return {
      path: "/api/oathnet/victims/:log_id/files/:file_id",
      params: {},
      pathParams: { log_id: resolved.logId, file_id: resolved.fileId },
      queryLabel: `${resolved.logId}/${resolved.fileId}`,
    };
  }

  if (resolved.kind === "victims-archive") {
    return {
      path: "/api/oathnet/victims/:log_id/archive",
      params: {},
      pathParams: { log_id: resolved.logId },
      queryLabel: resolved.logId,
    };
  }

  const endpoint = resolved.endpoint;
  const path = `/api/oathnet/${endpoint}`;

  switch (endpoint) {
    case "breach":
    case "stealer":
    case "victims": {
      const q = pick("query", "q", "term");

      // BreachHub mirror uses `query`; native mapper remaps to `q`.
      return q ? { path, params: { query: q }, queryLabel: q } : null;
    }
    case "stealer-subdomain":
    case "extract-subdomain": {
      const domain = pick("domain", "query");

      if (!domain) return null;
      const params: Record<string, string> = { domain };

      if (endpoint === "extract-subdomain") {
        params.is_alive = pick("is_alive") || "true";
      }

      return { path, params, queryLabel: domain };
    }
    case "discord-to-roblox":
    case "discord-userinfo":
    case "discord-username-history": {
      const discordId = pick("discord_id", "discordId", "query", "id");

      return discordId
        ? { path, params: { discord_id: discordId }, queryLabel: discordId }
        : null;
    }
    case "steam": {
      const steamId = pick("steam_id", "steamid", "query", "id");

      return steamId
        ? { path, params: { steam_id: steamId }, queryLabel: steamId }
        : null;
    }
    case "xbox": {
      const xbl = pick("xbl_id", "gamertag", "username", "query");

      return xbl ? { path, params: { xbl_id: xbl }, queryLabel: xbl } : null;
    }
    case "roblox-userinfo": {
      const cleaned = pick("username", "user_id", "query", "id").replace(
        /^@/,
        "",
      );

      if (!cleaned) return null;

      return /^\d+$/.test(cleaned)
        ? { path, params: { user_id: cleaned }, queryLabel: cleaned }
        : { path, params: { username: cleaned }, queryLabel: cleaned };
    }
    case "mc-history": {
      const username = pick("username", "query").replace(/^@/, "");

      return username
        ? { path, params: { username }, queryLabel: username }
        : null;
    }
    case "ip-info": {
      const ip = pick("ip", "query");

      return ip ? { path, params: { ip }, queryLabel: ip } : null;
    }
    case "holehe":
    case "ghunt": {
      const email = pick("email", "query");

      return email ? { path, params: { email }, queryLabel: email } : null;
    }
    default:
      return null;
  }
}

/**
 * Map BreachHub-shaped OathNet params onto native oathnet.org OpenAPI paths.
 * Docs: https://docs.oathnet.org/ — auth via lowercase `x-api-key` header.
 */
export function toNativeOathnetRequest(built: {
  path: string;
  params: Record<string, string>;
  pathParams?: Record<string, string>;
}): { path: string; params: Record<string, string> } | null {
  const pathParams = built.pathParams || {};
  const p = built.params;

  const logId = pathParams.log_id;
  const fileId = pathParams.file_id;

  if (built.path.includes("/victims/") && logId && fileId) {
    return {
      path: `/service/v2/victims/${encodeURIComponent(logId)}/files/${encodeURIComponent(fileId)}`,
      params: {},
    };
  }
  if (built.path.endsWith("/archive") && logId) {
    return {
      path: `/service/v2/victims/${encodeURIComponent(logId)}/archive`,
      params: {},
    };
  }
  if (built.path.includes("/victims/") && logId) {
    return {
      path: `/service/v2/victims/${encodeURIComponent(logId)}`,
      params: {},
    };
  }

  const leaf = built.path.replace(/^\/api\/oathnet\//, "").toLowerCase();

  switch (leaf) {
    case "breach": {
      const q = p.query || p.q;

      return q ? { path: "/service/v2/breach/search", params: { q } } : null;
    }
    case "stealer": {
      const q = p.query || p.q;

      return q ? { path: "/service/v2/stealer/search", params: { q } } : null;
    }
    case "victims": {
      const q = p.query || p.q;

      return q ? { path: "/service/v2/victims/search", params: { q } } : null;
    }
    case "stealer-subdomain": {
      const domain = p.domain;

      return domain
        ? { path: "/service/v2/stealer/subdomain", params: { domain } }
        : null;
    }
    case "extract-subdomain": {
      const domain = p.domain;

      if (!domain) return null;

      return {
        path: "/service/extract-subdomain",
        params: {
          domain,
          is_alive: p.is_alive || "true",
        },
      };
    }
    case "discord-to-roblox":
      return p.discord_id
        ? {
            path: "/service/discord-to-roblox",
            params: { discord_id: p.discord_id },
          }
        : null;
    case "discord-userinfo":
      return p.discord_id
        ? {
            path: "/service/discord-userinfo",
            params: { discord_id: p.discord_id },
          }
        : null;
    case "discord-username-history":
      return p.discord_id
        ? {
            path: "/service/discord-username-history",
            params: { discord_id: p.discord_id },
          }
        : null;
    case "steam":
      return p.steam_id
        ? { path: "/service/steam", params: { steam_id: p.steam_id } }
        : null;
    case "xbox":
      return p.xbl_id
        ? { path: "/service/xbox", params: { xbl_id: p.xbl_id } }
        : null;
    case "roblox-userinfo": {
      if (p.user_id) {
        return {
          path: "/service/roblox-userinfo",
          params: { user_id: p.user_id },
        };
      }
      if (p.username) {
        return {
          path: "/service/roblox-userinfo",
          params: { username: p.username },
        };
      }

      return null;
    }
    case "mc-history":
      return p.username
        ? { path: "/service/mc-history", params: { username: p.username } }
        : null;
    case "ip-info":
      return p.ip ? { path: "/service/ip-info", params: { ip: p.ip } } : null;
    case "holehe":
      return p.email
        ? { path: "/service/holehe", params: { email: p.email } }
        : null;
    case "ghunt":
      return p.email
        ? { path: "/service/ghunt", params: { email: p.email } }
        : null;
    default:
      return null;
  }
}

async function directOathnetNativeGet(opts: {
  path: string;
  params: Record<string, string>;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}): Promise<Record<string, unknown>> {
  const url = new URL(
    opts.path.startsWith("http")
      ? opts.path
      : `${opts.baseUrl.replace(/\/$/, "")}${opts.path}`,
  );

  for (const [key, value] of Object.entries(opts.params)) {
    if (value) url.searchParams.set(key, value);
  }

  const started = Date.now();

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": opts.apiKey,
        "User-Agent": "AnyaInt-oathnet/1.0",
      },
      cache: "no-store",
      timeoutMs: opts.timeoutMs,
    });
    const remaining = Math.max(2_000, opts.timeoutMs - (Date.now() - started));
    const text = await readResponseText(res, remaining);
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(
        !res.ok
          ? sanitizeBhVendorError(`HTTP ${res.status}`)
          : publicSearchError("Invalid response from intelligence index."),
      );
    }

    if (!res.ok || data.success === false) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;

      throw new Error(sanitizeBhVendorError(msg));
    }

    recordProviderRequest({
      gateway: "oathnet",
      path: opts.path,
      method: "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return data;
  } catch (err) {
    recordProviderRequest({
      gateway: "oathnet",
      path: opts.path,
      method: "GET",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err instanceof Error
      ? err
      : new Error(sanitizeBhVendorError("Request failed"));
  }
}

/** Live health probe — prefers native key, else BreachHub mirror. */
export async function probeOathNet(): Promise<boolean> {
  if (process.env.OATHNET_ENABLED === "false") return false;

  const key = getOathnetApiKey();

  if (key) {
    try {
      await directOathnetNativeGet({
        path: "/service/ip-info",
        params: { ip: "1.1.1.1" },
        apiKey: key,
        baseUrl: getOathnetBaseUrl(),
        timeoutMs: 8_000,
      });

      return true;
    } catch {
      return false;
    }
  }

  if (!isBreachHubEnabled()) return false;

  try {
    const { data } = await fetchBhMirroredGet({
      gateway: "oathnet",
      path: "/api/oathnet/ip-info",
      params: { ip: "1.1.1.1" },
      enabled: true,
      timeoutMs: 8_000,
    });

    return Boolean(data && typeof data === "object");
  } catch {
    return false;
  }
}

export async function fetchOathnetSanitized(
  resolved: OathnetResolved,
  input: Record<string, string>,
  timeoutMs = BH_VENDOR_DEFAULT_TIMEOUT_MS,
): Promise<OathnetSearchResult> {
  const built = buildOathnetParams(resolved, input);
  const endpointLabel =
    resolved.kind === "static"
      ? resolved.endpoint
      : resolved.kind === "victims-log"
        ? `victims/${resolved.logId}`
        : resolved.kind === "victims-file"
          ? `victims/${resolved.logId}/files/${resolved.fileId}`
          : `victims/${resolved.logId}/archive`;

  if (!built) {
    return {
      count: 0,
      results: [],
      query: "",
      endpoint: endpointLabel,
      source: "breachhub",
    };
  }

  const canDirect = hasDirectOathnetKey();
  const canBh = isBreachHubEnabled();
  const canCsintRoblox =
    resolved.kind === "static" &&
    resolved.endpoint === "discord-to-roblox" &&
    isCsintEnabled();

  const tryCsint = async (): Promise<OathnetSearchResult | null> => {
    if (!canCsintRoblox) return null;
    const fallback = await fetchCsintOathnetDiscordToRoblox(built.queryLabel);

    if (!fallback) return null;

    return {
      ...rowsFromBhPayload(fallback, built.queryLabel),
      query: built.queryLabel,
      endpoint: endpointLabel,
      source: "csint",
      raw: fallback,
    };
  };

  if (!canDirect && !canBh) {
    const csintOnly = await tryCsint();

    if (csintOnly) return csintOnly;
    throw new Error(publicServiceUnavailable());
  }

  try {
    if (canDirect) {
      const native = toNativeOathnetRequest(built);

      if (!native) {
        throw new Error(publicSearchError("Unsupported OathNet endpoint."));
      }

      const data = await directOathnetNativeGet({
        path: native.path,
        params: native.params,
        apiKey: getOathnetApiKey()!,
        baseUrl: getOathnetBaseUrl(),
        timeoutMs,
      });
      const sanitized = rowsFromBhPayload(data, built.queryLabel);

      if (sanitized.count === 0) {
        const csintFallback = await tryCsint();

        if (csintFallback) return csintFallback;
      }

      return {
        ...sanitized,
        query: built.queryLabel,
        endpoint: endpointLabel,
        source: "direct",
        raw: data,
      };
    }

    const { data, source } = await fetchBhMirroredGet({
      gateway: "oathnet",
      path: built.path,
      params: built.params,
      pathParams: built.pathParams,
      enabled: canBh,
      timeoutMs,
    });
    const sanitized = rowsFromBhPayload(data, built.queryLabel);

    if (sanitized.count === 0) {
      const csintFallback = await tryCsint();

      if (csintFallback) return csintFallback;
    }

    return {
      ...sanitized,
      query: built.queryLabel,
      endpoint: endpointLabel,
      source,
      raw: data,
    };
  } catch (err) {
    const csintFallback = await tryCsint();

    if (csintFallback) return csintFallback;
    throw err;
  }
}
