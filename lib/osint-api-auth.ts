import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { authorizeSearch } from "@/lib/plan-access";
import { getPlatformSearchConfig } from "@/lib/platform-search";

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
    reddit: "reddit",
    minecraft: "minecraft",
    fivem: "fivem",
    "crypto-wallet": "crypto-wallet",
    bin: "bin-lookup",
    iban: "iban-check",
    bank: "bank-search",
    vin: "vin-decoder",
    "car-insurance": "car-insurance-us",
    healthcare: "healthcare-us",
    geolocate: "ip",
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

  return { userId: session.userId as number };
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
