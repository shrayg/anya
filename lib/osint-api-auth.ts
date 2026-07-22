import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { authorizeSearch } from "@/lib/plan-access";
import { getPlatformSearchConfig } from "@/lib/platform-search";
import { maybeAutoFlagRiskySearch } from "@/lib/safety-flag-server";
import { assessSearchQueryForSafety } from "@/lib/safety-search-flags";

/**
 * Resolve which plan module a /api/osint/* call should be billed/gated as.
 * Prefer explicit moduleSlug from the client; fall back to path+scope mapping.
 */
export function resolveOsintModuleSlug(
  req: NextRequest,
  fallbackApiSegment: string,
): string | null {
  const explicit = req.nextUrl.searchParams.get("moduleSlug")?.trim();

  if (explicit) return explicit;

  const scope = req.nextUrl.searchParams.get("scope")?.trim();

  if (scope && getPlatformSearchConfig(scope)) {
    return scope;
  }

  if (fallbackApiSegment === "ai") {
    const mode = req.nextUrl.searchParams.get("mode")?.trim();

    if (mode === "deep") return "ai-deep-scan";
    if (mode === "crypto") return "crypto-ai";
    if (mode === "threat") return "threat-brief";

    return "ai-search";
  }

  const defaults: Record<string, string> = {
    breaches: "breaches",
    domains: "domains",
    dns: "domain",
    ip: "ip",
    intelx: "intelx",
    breach: "stealer-logs",
    discord: "discord-id",
    "discord/profile": "discord-id",
    roblox: "roblox",
    instagram: "instagram",
    reddit: "reddit",
    minecraft: "minecraft",
    fivem: "fivem",
    "crypto-wallet": "crypto-wallet",
    "crypto-full": "crypto-intel",
    "crypto-address": "crypto-address",
    "crypto-tx": "crypto-tx",
    "crypto-risk": "crypto-risk",
    "crypto-flow": "crypto-flow",
    bin: "bin-lookup",
    iban: "iban-check",
    bank: "bank-search",
    vin: "vin-decoder",
    "car-insurance": "car-insurance-us",
    healthcare: "healthcare-us",
    "public-records": "public-records",
    "us-court": "court-records",
    "us-identity": "identity-search",
    "us-npd": "npd-search",
    "us-va-sor": "va-sex-offender",
    "us-global": "global-public-records",
    "us-sanctions": "sanctions-watchlists",
    "us-wanted": "wanted-persons",
    "us-sor-national": "national-sor",
    "us-state-directory": "state-records-directory",
    "us-intl-directory": "international-records-directory",
    "us-portal-backlog": "portal-backlog",
    geolocate: "ip",
    "email-analyze": "email-analyze",
    "tiktok-recon": "tiktok-recon",
    "share-resolver": "share-resolver",
    "contact-enrich": "contact-enrich",
    "shodan-host": "shodan-host",
    "shodan/host": "shodan-host",
    "shodan/search": "shodan-host",
    "shodan/dns": "shodan-host",
    "shodan/dns/resolve": "shodan-host",
    "shodan/dns/reverse": "shodan-host",
    "shodan/honeyscore": "shodan-host",
    "site-pentest": "site-pentest",
    "seon-email": "fraud-footprint",
    "seon-phone": "fraud-footprint",
    breachbase: "breaches",
    "oathnet-roblox": "oathnet-roblox",
    "tinder-live": "tinder-live",
    "hinge-live": "hinge-live",
    "username-accounts": "account-finder",
    "handle-sweep": "handle-sweep",
    "email-presence": "email-presence",
    "index-sweep": "index-sweep",
    breachhub: "google-docs",
    "stealer-victim": "stealer-logs",
    snusbase: "snusbase",
    "snusbase/combo-lookup": "combo-lookup",
    "snusbase/hash-lookup": "hash-lookup",
    "snusbase/ip-whois": "ip-whois",
    "seeknow/search": "breaches",
    "seeknow/stealer": "stealer-logs",
    wentyn: "stealer-logs",
    reconly: "reconly",
    memory: "memory",
    leaksight: "breaches",
    inf0sec: "breaches",
    ipinfo: "ipinfo",
    github: "github",
    "seeknow/discord/user": "discord-id",
    "seeknow/discord/to-roblox": "discord-id",
    "seeknow/username/github": "github",
    "seeknow/username/twitter": "twitter",
    "seeknow/username/tiktok": "tiktok-recon",
    "seeknow/username/reddit": "reddit",
    "room101/analyze": "reddit",
    "room101/search": "reddit",
    "room101/v2/search": "reddit",
    "room101/user": "reddit",
    "room101/subreddit": "reddit",
    "seeknow/username/social": "username",
    "seeknow/username/history": "username",
    "seeknow/network/ip": "ip",
    "seeknow/network/email-check": "email-analyze",
    "seeknow/network/phone": "phone",
    "seeknow/domain/intel": "domains",
    "seeknow/domain/whois": "domains",
    "seeknow/gaming/xbox": "xbox",
    "seeknow/gaming/roblox": "roblox",
    "nbrs/roblox": "roblox",
    "seeknow/gaming/minecraft": "minecraft",
    "seekria/user-footprint": "username",
    "seekria/email-osint": "email-analyze",
    "seekria/domain-lookup": "domains",
    "seekria/discord": "discord-id",
    "seekria/roblox": "roblox",
    "seekria/minecraft": "minecraft",
    "seekria/ip": "ip",
    "seekria/dns-resolver": "domains",
    "seekria/email-breach": "breaches",
    "seekria/username-breach": "breaches",
    "seekria/phone-breach": "breaches",
    "seekria/discord-profile": "discord-id",
    "seekria/discord-to-rat": "discord-id",
    "seekria/fivem": "fivem",
    "seekria/minecraft-osint": "minecraft",
    "seekria/name-history": "minecraft",
    "seekria/laby-stats": "minecraft",
    "seekria/minecraft-texture": "minecraft",
    "seekria/tiktok-lookup": "tiktok-recon",
    "seekria/tiktok-breach": "tiktok-recon",
    "seekria/snusbase-breach": "breaches",
    "seekria/leakcheck-breach": "breaches",
    "osintcat/database-search": "stealer-logs",
    "osintcat/ip": "ip",
    "osintcat/twitter-osint": "twitter",
    "osintcat/machine-viewer": "stealer-logs",
  };

  return defaults[fallbackApiSegment] ?? null;
}

export async function requireOsintAccess(
  req: NextRequest,
  apiSegment: string,
): Promise<{ userId: number } | NextResponse> {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const moduleSlug = resolveOsintModuleSlug(req, apiSegment);

  if (!moduleSlug) {
    return NextResponse.json({ error: "Missing moduleSlug" }, { status: 400 });
  }

  const access = await authorizeSearch({
    userId: session.userId as number,
    moduleSlug,
  });

  if (!access.allowed) {
    return NextResponse.json(
      { error: "reason" in access ? access.reason : "Access denied" },
      { status: 403 },
    );
  }

  const userId = session.userId as number;
  const query = req.nextUrl.searchParams.get("query")?.trim();

  // Silent safety flag — never block the OSINT response.
  if (query && assessSearchQueryForSafety(query).flagged) {
    void maybeAutoFlagRiskySearch({
      userId,
      query,
      moduleSlug,
      searchType: moduleSlug,
    }).catch((error) => {
      console.error("Auto safety flag (osint) failed:", error);
    });
  }

  return { userId };
}

export async function requireAuthenticatedSession(): Promise<
  { userId: number; isAdmin?: boolean } | NextResponse
> {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    userId: session.userId as number,
    isAdmin: Boolean(session.isAdmin),
  };
}
