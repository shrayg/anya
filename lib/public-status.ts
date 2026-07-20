import {
  buildModuleHealthMap,
  MODULE_HEALTH_RULES,
  probeProviders,
} from "@/lib/module-health";
import { prisma } from "@/prisma/client";
import { isSquareConfigured } from "@/lib/square";
import { AI_SEARCH_MODULES, ALL_SEARCH_MODULES } from "@/lib/search-modules";
import { isCryptoIntelEnabled, isCryptoIntelSlug } from "@/lib/crypto-intel/enabled";
import {
  readStatusHistory,
  recordStatusHistorySample,
  type StatusHistoryPayload,
} from "@/lib/status-history";
import "server-only";

export type {
  StatusHistoryPayload,
  StatusHistorySeries,
} from "@/lib/status-history";

export type PublicStatusLevel = "operational" | "degraded" | "outage";

export type PublicStatusService = {
  id: string;
  name: string;
  description: string;
  group: string;
  status: PublicStatusLevel;
};

export type PublicStatusPayload = {
  overall: PublicStatusLevel;
  checkedAt: string;
  cached: boolean;
  services: PublicStatusService[];
  summary: {
    operational: number;
    degraded: number;
    outage: number;
  };
  history: StatusHistoryPayload;
};

type TimedResult = {
  ok: boolean;
};

async function timed(fn: () => Promise<boolean>): Promise<TimedResult> {
  try {
    const ok = await fn();

    return { ok };
  } catch {
    return { ok: false };
  }
}

function isJwtReady(): boolean {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || secret === "change-me" || secret === "super-secret-jwt-key") {
    return process.env.NODE_ENV !== "production";
  }

  return true;
}

function ratioToStatus(up: number, total: number): PublicStatusLevel {
  if (total <= 0) return "outage";
  const ratio = up / total;

  if (ratio >= 0.85) return "operational";
  if (ratio >= 0.4) return "degraded";

  return "outage";
}

function aggregateModuleStatus(
  modules: Record<string, boolean>,
  slugs: string[],
): PublicStatusLevel {
  const active = slugs.filter((slug) => {
    const rule = MODULE_HEALTH_RULES[slug];

    return rule && rule.kind !== "off";
  });
  const up = active.filter((slug) => modules[slug]).length;

  return ratioToStatus(up, active.length);
}

function worstStatus(levels: PublicStatusLevel[]): PublicStatusLevel {
  if (levels.includes("outage")) return "outage";
  if (levels.includes("degraded")) return "degraded";

  return "operational";
}

function overallFromServices(
  services: PublicStatusService[],
): PublicStatusLevel {
  const criticalIds = new Set(["website", "database", "auth", "api"]);
  const critical = services.filter((s) => criticalIds.has(s.id));
  const criticalWorst = worstStatus(critical.map((s) => s.status));

  if (criticalWorst === "outage") return "outage";

  const anyOutage = services.some((s) => s.status === "outage");

  if (anyOutage || criticalWorst === "degraded") return "degraded";

  return worstStatus(services.map((s) => s.status));
}

/**
 * Build a public-safe platform status snapshot.
 * Never returns provider names, API keys, latency, or internal error details.
 */
export async function getPublicStatus(options?: {
  cached?: boolean;
  recordHistory?: boolean;
}): Promise<PublicStatusPayload> {
  const [db, providersTimed] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`;

      return true;
    }),
    (async () => {
      try {
        const providers = await probeProviders();

        return {
          providers,
          ok: true as const,
        };
      } catch {
        return {
          providers: null,
          ok: false as const,
        };
      }
    })(),
  ]);

  const modules = providersTimed.providers
    ? buildModuleHealthMap(providersTimed.providers)
    : {};

  const aiSlugs = AI_SEARCH_MODULES.map((m) => m.slug);
  const searchSlugs = ALL_SEARCH_MODULES.map((m) => m.slug).filter((slug) => {
    if (aiSlugs.includes(slug)) return false;
    if (!isCryptoIntelEnabled() && isCryptoIntelSlug(slug)) return false;

    return true;
  });

  const aiStatus = aggregateModuleStatus(modules, aiSlugs);
  const searchStatus = aggregateModuleStatus(modules, searchSlugs);

  const jwtOk = isJwtReady();
  const authOk = db.ok && jwtOk;
  const billingConfigured = isSquareConfigured();

  const services: PublicStatusService[] = [
    {
      id: "website",
      name: "Website",
      description: "Public site and status endpoints.",
      group: "Platform",
      status: "operational",
    },
    {
      id: "database",
      name: "Accounts database",
      description: "Accounts, billing records, and search history.",
      group: "Platform",
      status: db.ok ? "operational" : "outage",
    },
    {
      id: "auth",
      name: "Authentication",
      description: "Login, sessions, and account access.",
      group: "Platform",
      status: authOk ? "operational" : db.ok ? "degraded" : "outage",
    },
    {
      id: "api",
      name: "Dashboard & API",
      description: "Workspace routes and search API gateway.",
      group: "Platform",
      status: db.ok ? "operational" : "degraded",
    },
    {
      id: "search",
      name: "Search intelligence",
      description: "Identity, network, platform, and exposure lookup modules.",
      group: "Intelligence",
      status: providersTimed.ok ? searchStatus : "outage",
    },
    {
      id: "ai",
      name: "AI analyzer",
      description: "In-workspace AI synthesis and threat briefs.",
      group: "Intelligence",
      status: providersTimed.ok ? aiStatus : "outage",
    },
    {
      id: "billing",
      name: "Billing & checkout",
      description: "Plan purchases, credits, and fulfillment.",
      group: "Platform",
      status: billingConfigured ? "operational" : "degraded",
    },
  ];

  const summary = {
    operational: services.filter((s) => s.status === "operational").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    outage: services.filter((s) => s.status === "outage").length,
  };

  const overall = overallFromServices(services);

  let history: StatusHistoryPayload;

  if (options?.recordHistory !== false) {
    try {
      history = recordStatusHistorySample({ overall, services });
    } catch {
      history = readStatusHistory();
    }
  } else {
    history = readStatusHistory();
  }

  return {
    overall,
    checkedAt: new Date().toISOString(),
    cached: options?.cached ?? false,
    services,
    summary,
    history,
  };
}
