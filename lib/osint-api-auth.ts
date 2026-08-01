import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { authorizeSearch } from "@/lib/plan-access";
import { redactOsintTeaser } from "@/lib/osint-teaser-redact";
import {
  shouldBlurResults,
  STARTER_MODULE_SLUGS,
} from "@/lib/plans";
import { getPlatformSearchConfig } from "@/lib/platform-search";
import { maybeAutoFlagRiskySearch } from "@/lib/safety-flag-server";
import { assessSearchQueryForSafety } from "@/lib/safety-search-flags";
import { consumeRateLimit } from "@/lib/simple-rate-limit";

/** Homepage starter modules + email-analyze companion panel. */
export const GUEST_HOME_MODULE_SLUGS = new Set([
  ...STARTER_MODULE_SLUGS,
  "email-analyze",
]);

const GUEST_DAILY_SEARCH_LIMIT = 5;
const GUEST_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OsintAccessOk = {
  userId: number | null;
  blurResults: boolean;
  isGuest: boolean;
};

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

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
    stealer: "stealer-logs",
    discord: "discord-id",
    "discord/profile": "discord-id",
    "discord/user": "discord-id",
    "discord/history": "discord-id",
    "discord/export": "discord-id",
    "discord/snowflake": "discord-id",
    roblox: "roblox",
    instagram: "instagram",
    "instagram/id": "instagram",
    reddit: "reddit",
    minecraft: "minecraft",
    fivem: "fivem",
    "crypto-wallet": "crypto-intel",
    "crypto-full": "crypto-intel",
    "crypto-address": "crypto-intel",
    "crypto-tx": "crypto-intel",
    "crypto-risk": "crypto-intel",
    "crypto-flow": "crypto-intel",
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
    propertyradar: "propertyradar",
    "propertyradar/search": "propertyradar",
    "propertyradar/persons": "propertyradar",
    "propertyradar/phone": "propertyradar",
    "propertyradar/email": "propertyradar",
    "propertyradar/skiptrace": "propertyradar",
    "propertyradar-search": "propertyradar",
    "propertyradar-persons": "propertyradar",
    "propertyradar-phone": "propertyradar",
    "propertyradar-email": "propertyradar",
    "propertyradar-skiptrace": "propertyradar",
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
    "seon/email": "fraud-footprint",
    "seon/phone": "fraud-footprint",
    "seon/email-verification": "fraud-footprint",
    "seon/ip": "ip",
    "seon/bin": "bin-lookup",
    breachbase: "breaches",
    "oathnet-roblox": "discord-id",
    "tinder-live": "tinder-live",
    "hinge-live": "hinge-live",
    "username-accounts": "account-finder",
    "handle-sweep": "handle-sweep",
    "email-presence": "email-presence",
    "index-sweep": "index-sweep",
    breachhub: "google-docs",
    passport: "passport",
    ganknow: "ganknow",
    "google-docs": "google-docs",
    notalivex: "notalivex-country",
    "notalivex/mx/email": "notalivex-country",
    "notalivex/mx/telefono": "notalivex-country",
    "notalivex/mx/curp": "notalivex-country",
    "notalivex/mx/rfc": "notalivex-country",
    "notalivex/mx/nombre": "notalivex-country",
    "notalivex/ar/email": "notalivex-country",
    "notalivex/ar/dni": "notalivex-country",
    "notalivex/ar/telefono": "notalivex-country",
    "notalivex/ar/nombre": "notalivex-country",
    "notalivex/br/email": "notalivex-country",
    "notalivex/br/cpf": "notalivex-country",
    "notalivex/br/fone": "notalivex-country",
    "notalivex/cl/email": "notalivex-country",
    "notalivex/cl/rut": "notalivex-country",
    "notalivex/cl/telefono": "notalivex-country",
    "notalivex/co/email": "notalivex-country",
    "notalivex/co/cedula": "notalivex-country",
    "notalivex/pe/email": "notalivex-country",
    "notalivex/us/email": "notalivex-country",
    "notalivex/es/email": "notalivex-country",
    "notalivex/tg/username": "notalivex-platform",
    "notalivex/tg/id": "notalivex-platform",
    "notalivex/tg/telefono": "notalivex-platform",
    "notalivex/instagram/username": "notalivex-platform",
    "notalivex/instagram/email": "notalivex-platform",
    "notalivex/instagram/telefono": "notalivex-platform",
    "notalivex/osint/social": "notalivex-platform",
    "notalivex/ar_rena/renaper": "notalivex-renaper",
    "stealer-victim": "stealer-logs",
    snusbase: "snusbase",
    "snusbase/combo-lookup": "combo-lookup",
    "snusbase/hash-lookup": "hash-lookup",
    "snusbase/ip-whois": "ip-whois",
    "seeknow/search": "breaches",
    "seeknow/stealer": "stealer-logs",
    wentyn: "stealer-logs",
    melissa: "contact-enrich",
    reconly: "reconly",
    memory: "memory",
    medal: "username",
    leaksight: "breaches",
    inf0sec: "breaches",
    checko: "checko",
    ipinfo: "ip",
    github: "github",
    binlist: "bin-lookup",
    "nosint/search": "breaches",
    "nosint/ip": "ip",
    datavoid: "datavoid",
    "datavoid/recovery": "datavoid",
    "datavoid/us": "datavoid",
    "datavoid/ca": "datavoid",
    "datavoid/il": "datavoid",
    "datavoid/stealer": "stealer-logs",
    "datavoid/automotive": "vin-decoder",
    "datavoid/automotive/check": "vin-decoder",
    "datavoid/company": "datavoid",
    "datavoid/discord": "discord-id",
    "datavoid/twitter": "twitter",
    "datavoid/fivem": "fivem",
    "datavoid/roblox": "roblox",
    "datavoid/geocode": "ip",
    "datavoid/reverse-geocode": "ip",
    "datavoid/instagram": "instagram",
    "datavoid/google-docs": "google-docs",
    "hudsonrock/search-by-domain": "stealer-logs",
    "hudsonrock/search-by-domain/overview": "stealer-logs",
    "hudsonrock/search-by-domain/assessment": "stealer-logs",
    "hudsonrock/search-by-domain/discovery": "stealer-logs",
    "hudsonrock/search-by-login/emails": "stealer-logs",
    "hudsonrock/search-by-login/usernames": "stealer-logs",
    "hudsonrock/search-by-ip": "stealer-logs",
    "hudsonrock/search-by-keyword": "stealer-logs",
    "hudsonrock/search-by-keyword/urls": "stealer-logs",
    "hudsonrock/search-by-stealer/infection-analysis": "stealer-logs",
    "oathnet/breach": "breaches",
    "oathnet/stealer": "stealer-logs",
    "oathnet/stealer-subdomain": "stealer-logs",
    "oathnet/extract-subdomain": "domain",
    "oathnet/victims": "stealer-logs",
    "oathnet/discord-to-roblox": "discord-id",
    "oathnet/discord-userinfo": "discord-id",
    "oathnet/discord-username-history": "discord-id",
    "oathnet/steam": "steam",
    "oathnet/xbox": "xbox",
    "oathnet/roblox-userinfo": "roblox",
    "oathnet/mc-history": "minecraft",
    "oathnet/ip-info": "ip",
    "oathnet/holehe": "breaches",
    "oathnet/ghunt": "breaches",
    telegram: "telegram",
    "telegram/username": "telegram",
    "telegram/id": "telegram",
    "telegram/phone": "telegram",
    snapchat: "snapchat",
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
    "seeknow/domain/intel": "domain",
    "seeknow/domain/whois": "domain",
    "seeknow/gaming/xbox": "xbox",
    "seeknow/gaming/roblox": "roblox",
    "nbrs/roblox": "roblox",
    "seeknow/gaming/minecraft": "minecraft",
    "seekria/user-footprint": "username",
    "seekria/email-osint": "email-analyze",
    "seekria/domain-lookup": "domain",
    "seekria/discord": "discord-id",
    "seekria/roblox": "roblox",
    "seekria/minecraft": "minecraft",
    "seekria/ip": "ip",
    "seekria/dns-resolver": "domain",
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
    "seekria/tiktok-breach": "breaches",
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
): Promise<OsintAccessOk | NextResponse> {
  const moduleSlug = resolveOsintModuleSlug(req, apiSegment);

  if (!moduleSlug) {
    return NextResponse.json({ error: "Missing moduleSlug" }, { status: 400 });
  }

  const session = await getSessionCookie();

  if (!session?.userId) {
    if (!GUEST_HOME_MODULE_SLUGS.has(moduleSlug)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = consumeRateLimit(
      `guest-osint:${clientIp(req)}`,
      GUEST_DAILY_SEARCH_LIMIT,
      GUEST_RATE_WINDOW_MS,
    );

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Guest search limit reached. Create an account and buy a plan for more lookups.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, rate.retryAfterSeconds)),
          },
        },
      );
    }

    return { userId: null, blurResults: true, isGuest: true };
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

  const blurResults =
    Boolean("blurResults" in access && access.blurResults) ||
    ("plan" in access && shouldBlurResults(access.plan));

  return { userId, blurResults, isGuest: false };
}

/** JSON response that redacts sensitive fields when the caller is on a teaser plan. */
export function osintJson(
  access: OsintAccessOk,
  data: unknown,
  init?: ResponseInit,
): NextResponse {
  if (!access.blurResults) {
    return NextResponse.json(data, init);
  }

  const redacted = redactOsintTeaser(data, { isGuest: access.isGuest });

  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return NextResponse.json(
      {
        ...(redacted as Record<string, unknown>),
        blurResults: true,
        teaser: true,
      },
      init,
    );
  }

  return NextResponse.json(
    { data: redacted, blurResults: true, teaser: true },
    init,
  );
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
