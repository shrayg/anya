/**
 * OathNet specialty client — full BreachHub /api/oathnet/* surface.
 *
 * Upstream: direct OATHNET_API_KEY or BreachHub; discord-to-roblox may fall
 * back to CSINT when BreachHub is empty.
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
import {
  fetchCsintOathnetDiscordToRoblox,
  isCsintEnabled,
} from "@/lib/csint";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { publicServiceUnavailable } from "@/lib/public-branding";

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
  return (
    process.env.OATHNET_BASE_URL?.trim() || BH_VENDOR_DEFAULT_BASE
  ).replace(/\/$/, "");
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

  const canBh = hasDirectOathnetKey() || isBreachHubEnabled();
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

  if (!canBh) {
    const csintOnly = await tryCsint();

    if (csintOnly) return csintOnly;
    throw new Error(publicServiceUnavailable());
  }

  try {
    const { data, source } = await fetchBhMirroredGet({
      gateway: "oathnet",
      path: built.path,
      params: built.params,
      pathParams: built.pathParams,
      directKey: getOathnetApiKey(),
      directBaseUrl: getOathnetBaseUrl(),
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
