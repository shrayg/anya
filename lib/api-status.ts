/**
 * Admin API status catalog — gateways + BreachHub/CSINT endpoints with health.
 */

import "server-only";

import {
  listBreachHubEndpoints,
  isBreachHubEnabled,
  type BreachHubSection,
} from "@/lib/breachhub";
import { isCsintEnabled } from "@/lib/csint";
import { isBreachVipEnabled } from "@/lib/breachvip";
import { isCordCatConfigured } from "@/lib/cordcat";
import { getOsintCatApiKey } from "@/lib/osintcat";
import {
  getGodsEyeApiKey,
  getGodsEyeExportApiKey,
  isGodsEyeEnabled,
} from "@/lib/godseye";
import {
  probeProvidersDetailed,
  type ProviderId,
  type ProviderProbeResult,
} from "@/lib/module-health";
import {
  getSkippedBreachHubEndpointIds,
  isBreachHubPrimaryActive,
  VENDOR_GATEWAY_PRIMARIES,
} from "@/lib/provider-dedupe";
import {
  getProviderRequest,
  type ProviderRequestLogEntry,
} from "@/lib/provider-request-log";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type ApiHealthStatus = "online" | "slow" | "offline" | "maintenance";

export type ApiStatusRow = {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ApiHealthStatus;
  endpoint: string;
  method: string;
  lastRequest: string | null;
  lastResponseMs: number | null;
  gateway: string;
  vendor: string;
  role: "gateway" | "endpoint" | "fallback";
  section?: string;
  note?: string;
  error?: string;
};

export type ApiStatusPayload = {
  checkedAt: string;
  openapiVersion: string | null;
  openapiFetched: boolean;
  summary: Record<ApiHealthStatus, number>;
  gateways: ApiStatusRow[];
  endpoints: ApiStatusRow[];
  vendorPolicy: typeof VENDOR_GATEWAY_PRIMARIES;
};

const SLOW_MS = 4_000;
const OPENAPI_TTL_MS = 60 * 60_000;
const OPENAPI_URLS = [
  "https://breachhub.org/api/openapi",
  "https://breachhub.org/openapi.json",
];

type OpenApiCache = {
  expiresAt: number;
  version: string | null;
  byPath: Map<string, { method: string; summary: string; vendor: string }>;
};

let openApiCache: OpenApiCache | null = null;

const SECTION_LABELS: Record<BreachHubSection, string> = {
  data_breach: "Data Breach",
  intelligence_platform: "Intelligence",
  social_osint: "Social OSINT",
  specialized_tools: "Specialized",
  network_intelligence: "Network",
  user_lookup: "User Lookup",
};

const CSINT_ENDPOINTS: Array<{
  id: string;
  path: string;
  name: string;
  description: string;
  vendor: string;
  mirrored?: boolean;
}> = [
  {
    id: "csint-status",
    path: "/status",
    name: "CSINT Status",
    description: "Provider health / status probe.",
    vendor: "CSINT",
  },
  {
    id: "csint-search",
    path: "/search",
    name: "Universal Search",
    description: "Multi-source breach and identity search.",
    vendor: "CSINT",
    mirrored: true,
  },
  {
    id: "csint-snusbase",
    path: "/snusbase/search",
    name: "Snusbase Search",
    description: "Snusbase breach lookup via CSINT.",
    vendor: "Snusbase",
    mirrored: true,
  },
  {
    id: "csint-snusbase-hash",
    path: "/snusbase/hash-lookup",
    name: "Snusbase Hash",
    description: "Hash lookup against Snusbase.",
    vendor: "Snusbase",
    mirrored: true,
  },
  {
    id: "csint-breachbase",
    path: "/breachbase",
    name: "BreachBase",
    description: "BreachBase credential search.",
    vendor: "BreachBase",
    mirrored: true,
  },
  {
    id: "csint-shodan",
    path: "/shodan/host",
    name: "Shodan Host",
    description: "Shodan host/IP enrichment.",
    vendor: "Shodan",
    mirrored: true,
  },
  {
    id: "csint-seon-email",
    path: "/seon/email",
    name: "SEON Email",
    description: "SEON email fraud footprint.",
    vendor: "SEON",
    mirrored: true,
  },
  {
    id: "csint-seon-phone",
    path: "/seon/phone",
    name: "SEON Phone",
    description: "SEON phone fraud footprint.",
    vendor: "SEON",
    mirrored: true,
  },
  {
    id: "csint-melissa",
    path: "/melissa/lookup",
    name: "Melissa Lookup",
    description: "Contact enrichment via Melissa.",
    vendor: "Melissa",
    mirrored: true,
  },
  {
    id: "csint-oathnet-d2r",
    path: "/oathnet/discord-to-roblox",
    name: "Discord→Roblox",
    description: "Discord ID to Roblox account mapping.",
    vendor: "Identity intel",
    mirrored: true,
  },
  {
    id: "csint-intelx",
    path: "/intelx",
    name: "IntelX Export",
    description: "Intelligence X storage export.",
    vendor: "IntelX",
    mirrored: true,
  },
  {
    id: "csint-discord-lookup",
    path: "/discord/lookup",
    name: "Discord Lookup",
    description: "Discord user lookup.",
    vendor: "CSINT",
  },
  {
    id: "csint-discord-osint",
    path: "/discord/osint",
    name: "Discord OSINT",
    description: "Discord OSINT enrichment.",
    vendor: "CSINT",
  },
  {
    id: "csint-iplookup",
    path: "/iplookup",
    name: "IP Lookup",
    description: "IP geolocation and reputation.",
    vendor: "CSINT",
  },
  {
    id: "csint-crypto",
    path: "/crypto",
    name: "Crypto Address",
    description: "Cryptocurrency address intelligence.",
    vendor: "CSINT",
  },
  {
    id: "csint-email-analyze",
    path: "/email/analyze",
    name: "Email Analyze",
    description: "Email risk and presence analysis.",
    vendor: "CSINT",
  },
  {
    id: "csint-reddit",
    path: "/reddit",
    name: "Reddit",
    description: "Reddit username OSINT.",
    vendor: "CSINT",
  },
  {
    id: "csint-tiktok",
    path: "/tiktokrecon",
    name: "TikTok Recon",
    description: "TikTok username reconnaissance.",
    vendor: "CSINT",
  },
  {
    id: "csint-share",
    path: "/share-resolver",
    name: "Share Resolver",
    description: "Resolve shared media / short links.",
    vendor: "CSINT",
  },
  {
    id: "csint-minecraft",
    path: "/intelfetch/minecraft",
    name: "Minecraft Server",
    description: "Minecraft server intel.",
    vendor: "CSINT",
  },
];

function titleFromId(id: string): string {
  return id
    .replace(/^oathnet[-_]?/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Never surface the OathNet vendor string in admin / health UI. */
function scrubVendorBrand(label: string): string {
  if (/oath\s*net/i.test(label)) return "Identity intel";

  return label;
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;

  return path.replace(/\/+$/, "") || "/";
}

async function loadBreachHubOpenApi(): Promise<OpenApiCache> {
  const now = Date.now();

  if (openApiCache && openApiCache.expiresAt > now) {
    return openApiCache;
  }

  const byPath = new Map<
    string,
    { method: string; summary: string; vendor: string }
  >();
  let version: string | null = null;

  for (const url of OPENAPI_URLS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        timeoutMs: 12_000,
      });

      if (!res.ok) continue;

      const json = (await res.json()) as {
        info?: { version?: string };
        paths?: Record<
          string,
          Record<
            string,
            { summary?: string; tags?: string[]; description?: string }
          >
        >;
      };

      version =
        typeof json.info?.version === "string" ? json.info.version : version;

      for (const [path, ops] of Object.entries(json.paths ?? {})) {
        const methods = Object.keys(ops).filter(
          (key) =>
            ["get", "post", "put", "patch", "delete", "head"].includes(
              key.toLowerCase(),
            ),
        );
        const method = methods[0] ?? "get";
        const op = ops[method] ?? {};
        const vendor = scrubVendorBrand(
          Array.isArray(op.tags) && typeof op.tags[0] === "string"
            ? op.tags[0]
            : titleFromId(path.split("/").filter(Boolean).slice(-1)[0] ?? "API"),
        );

        byPath.set(normalizePath(path), {
          method: method.toUpperCase(),
          summary:
            (typeof op.summary === "string" && op.summary) ||
            (typeof op.description === "string" && op.description) ||
            "",
          vendor,
        });
      }

      if (byPath.size > 0) break;
    } catch {
      // try next URL
    }
  }

  openApiCache = {
    expiresAt: now + OPENAPI_TTL_MS,
    version,
    byPath,
  };

  return openApiCache;
}

function statusFromProbe(
  probe: ProviderProbeResult | undefined,
  configured: boolean,
  last?: ProviderRequestLogEntry,
): { status: ApiHealthStatus; error?: string; lastRequest: string | null; lastResponseMs: number | null } {
  if (!configured) {
    return {
      status: "maintenance",
      error: "Not configured / disabled",
      lastRequest: last?.at ?? null,
      lastResponseMs: last?.latencyMs ?? null,
    };
  }

  if (last) {
    if (!last.ok) {
      const maintenance =
        last.statusCode === 503 ||
        /maintenance|temporarily unavailable/i.test(last.error ?? "");

      return {
        status: maintenance ? "maintenance" : "offline",
        error: last.error,
        lastRequest: last.at,
        lastResponseMs: last.latencyMs,
      };
    }

    return {
      status: last.latencyMs >= SLOW_MS ? "slow" : "online",
      lastRequest: last.at,
      lastResponseMs: last.latencyMs,
    };
  }

  if (!probe || probe.unprobed) {
    return {
      status: "maintenance",
      error: probe?.error ?? "Unprobed",
      lastRequest: null,
      lastResponseMs: null,
    };
  }

  if (!probe.ok) {
    const maintenance = /maintenance|503/i.test(probe.error ?? "");

    return {
      status: maintenance ? "maintenance" : "offline",
      error: probe.error,
      lastRequest: null,
      lastResponseMs: probe.latencyMs,
    };
  }

  return {
    status: probe.latencyMs >= SLOW_MS ? "slow" : "online",
    lastRequest: null,
    lastResponseMs: probe.latencyMs,
  };
}

function inheritGatewayStatus(
  gatewayStatus: ApiHealthStatus,
  last?: ProviderRequestLogEntry,
): { status: ApiHealthStatus; error?: string; lastRequest: string | null; lastResponseMs: number | null } {
  if (last) {
    if (!last.ok) {
      const maintenance =
        last.statusCode === 503 ||
        /maintenance|temporarily unavailable/i.test(last.error ?? "");

      return {
        status: maintenance ? "maintenance" : "offline",
        error: last.error,
        lastRequest: last.at,
        lastResponseMs: last.latencyMs,
      };
    }

    return {
      status: last.latencyMs >= SLOW_MS ? "slow" : "online",
      lastRequest: last.at,
      lastResponseMs: last.latencyMs,
    };
  }

  return {
    status: gatewayStatus,
    lastRequest: null,
    lastResponseMs: null,
  };
}

function buildGatewayRow(
  id: string,
  name: string,
  description: string,
  endpoint: string,
  method: string,
  version: string,
  probe: ProviderProbeResult | undefined,
  configured: boolean,
  last?: ProviderRequestLogEntry,
  note?: string,
): ApiStatusRow {
  const derived = statusFromProbe(probe, configured, last);

  return {
    id,
    name,
    description,
    version,
    status: derived.status,
    endpoint,
    method,
    lastRequest: derived.lastRequest,
    lastResponseMs: derived.lastResponseMs,
    gateway: name,
    vendor: name,
    role: "gateway",
    note,
    error: derived.error,
  };
}

export async function buildApiStatusPayload(): Promise<ApiStatusPayload> {
  const [detailed, openapi] = await Promise.all([
    probeProvidersDetailed(),
    loadBreachHubOpenApi(),
  ]);

  const byId = new Map(detailed.map((row) => [row.id, row]));
  const skipped = getSkippedBreachHubEndpointIds();
  const bhPrimary = isBreachHubPrimaryActive();
  const bhVersion = openapi.version ?? "2.0";

  const breachhubLast = getProviderRequest("breachhub", "/api/status", "GET");
  const csintLast = getProviderRequest("csint", "/status", "POST");
  const oathnetLast = getProviderRequest(
    "breachhub",
    "/api/oathnet/ip-info",
    "GET",
  );

  const gateways: ApiStatusRow[] = [
    buildGatewayRow(
      "gateway-breachhub",
      "BreachHub",
      "Unified REST gateway for 40+ breach and OSINT sources.",
      "https://breachhub.org/api/status",
      "GET",
      bhVersion,
      byId.get("breachhub"),
      isBreachHubEnabled(),
      breachhubLast,
      "Primary for mirrored vendors",
    ),
    buildGatewayRow(
      "gateway-csint",
      "CSINT",
      "csint.pro enrichment gateway (sequential fallback when BreachHub is primary).",
      "https://csint.pro/api/status",
      "POST",
      "1.0",
      byId.get("csint"),
      isCsintEnabled(),
      csintLast,
      bhPrimary ? "Fallback when BreachHub fails/empty" : "Active enrichment gateway",
    ),
    buildGatewayRow(
      "gateway-osintcat",
      "OsintCat",
      "Direct OsintCat breach / stalker index.",
      "https://www.osintcat.net/api/breach",
      "GET",
      "1.0",
      byId.get("osintcat"),
      Boolean(getOsintCatApiKey()?.trim()),
      undefined,
      bhPrimary ? "Direct fallback when BreachHub is off/fails" : undefined,
    ),
    buildGatewayRow(
      "gateway-godseye",
      "GodsEye",
      "Live search ingress (godseye.cat).",
      "https://godseye.cat",
      "POST",
      "1.0",
      byId.get("godseye"),
      isGodsEyeEnabled() && Boolean(getGodsEyeApiKey()),
    ),
    buildGatewayRow(
      "gateway-godseye-export",
      "GodsEye Export",
      "IntelX-style export via GodsEye.",
      "https://godseye.cat",
      "POST",
      "1.0",
      byId.get("godseye-export"),
      Boolean(getGodsEyeExportApiKey()),
    ),
    buildGatewayRow(
      "gateway-breachvip",
      "BreachVIP",
      "Direct breach.vip comb index.",
      "https://breach.vip/api/search",
      "POST",
      "1.0",
      byId.get("breachvip"),
      isBreachVipEnabled(),
      undefined,
      bhPrimary ? "Direct fallback when BreachHub is off/fails" : undefined,
    ),
    buildGatewayRow(
      "gateway-cordcat",
      "CordCat",
      "Discord profile gateway (api.cord.cat).",
      "https://api.cord.cat",
      "GET",
      "1.0",
      byId.get("cordcat"),
      isCordCatConfigured(),
      undefined,
      bhPrimary ? "Direct fallback when BreachHub is off" : undefined,
    ),
    buildGatewayRow(
      "gateway-oathnet",
      "Identity intel",
      "Specialty identity / gaming intel health via BreachHub mirror.",
      "https://breachhub.org/api/oathnet/ip-info",
      "GET",
      bhVersion,
      byId.get("oathnet"),
      isBreachHubEnabled(),
      oathnetLast,
      "Shown separately so ops can see identity-intel red/green",
    ),
  ];

  const bhGatewayStatus =
    gateways.find((row) => row.id === "gateway-breachhub")?.status ?? "offline";
  const csintGatewayStatus =
    gateways.find((row) => row.id === "gateway-csint")?.status ?? "offline";

  const endpoints: ApiStatusRow[] = [];

  for (const endpoint of listBreachHubEndpoints()) {
    const meta = openapi.byPath.get(normalizePath(endpoint.path));
    const last = getProviderRequest("breachhub", endpoint.path, "GET");
    const isSkipped = skipped.has(endpoint.id);
    const vendor = scrubVendorBrand(
      meta?.vendor ?? titleFromId(endpoint.id),
    );
    const derived = isSkipped
      ? {
          status: "maintenance" as const,
          error: "Skipped IntelBase mirror (same fan-out as direct BH vendor)",
          lastRequest: last?.at ?? null,
          lastResponseMs: last?.latencyMs ?? null,
        }
      : inheritGatewayStatus(bhGatewayStatus, last);

    endpoints.push({
      id: `bh-${endpoint.id}`,
      name: titleFromId(endpoint.id),
      description:
        meta?.summary ||
        `${SECTION_LABELS[endpoint.section] ?? endpoint.section} — ${endpoint.path}`,
      version: bhVersion,
      status: !isBreachHubEnabled() ? "maintenance" : derived.status,
      endpoint: endpoint.path,
      method: meta?.method ?? "GET",
      lastRequest: derived.lastRequest,
      lastResponseMs: derived.lastResponseMs,
      gateway: "BreachHub",
      vendor,
      role: "endpoint",
      section: SECTION_LABELS[endpoint.section],
      note: isSkipped
        ? "Hidden from fan-out (IntelBase mirror)"
        : `Kinds: ${endpoint.kinds.join(", ")}`,
      error: !isBreachHubEnabled()
        ? "BreachHub disabled"
        : derived.error,
    });
  }

  for (const endpoint of CSINT_ENDPOINTS) {
    const last = getProviderRequest("csint", endpoint.path, "POST");
    const isFallback = Boolean(endpoint.mirrored && bhPrimary);
    const derived = inheritGatewayStatus(csintGatewayStatus, last);

    endpoints.push({
      id: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      version: "1.0",
      status: !isCsintEnabled() ? "maintenance" : derived.status,
      endpoint: endpoint.path,
      method: "POST",
      lastRequest: derived.lastRequest,
      lastResponseMs: derived.lastResponseMs,
      gateway: "CSINT",
      vendor: endpoint.vendor,
      role: isFallback ? "fallback" : "endpoint",
      section: "CSINT",
      note: isFallback
        ? "CSINT fallback — BreachHub is primary for this vendor"
        : undefined,
      error: !isCsintEnabled() ? "CSINT disabled" : derived.error,
    });
  }

  const all = [...gateways, ...endpoints];
  const summary: Record<ApiHealthStatus, number> = {
    online: 0,
    slow: 0,
    offline: 0,
    maintenance: 0,
  };

  for (const row of all) {
    summary[row.status] += 1;
  }

  return {
    checkedAt: new Date().toISOString(),
    openapiVersion: openapi.version,
    openapiFetched: openapi.byPath.size > 0,
    summary,
    gateways,
    endpoints,
    vendorPolicy: VENDOR_GATEWAY_PRIMARIES,
  };
}

/** Exported for tests / tooling — maps probe ids used in health strip. */
export function probeIdForGateway(gateway: string): ProviderId | null {
  const map: Record<string, ProviderId> = {
    BreachHub: "breachhub",
    CSINT: "csint",
    OsintCat: "osintcat",
    GodsEye: "godseye",
    "GodsEye Export": "godseye-export",
    BreachVIP: "breachvip",
    CordCat: "cordcat",
    "Identity intel": "oathnet",
  };

  return map[gateway] ?? null;
}
