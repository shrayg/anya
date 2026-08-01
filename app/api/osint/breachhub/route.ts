import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachHubSpecialty,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

/** Unique BreachHub surfaces: google-docs, ganknow, xbox, machine-viewer. */
const ALLOWED_SCOPES = new Set([
  "google-docs",
  "ganknow",
  "xbox",
  "email",
  "bin",
  "vin",
  "crypto",
  "hwid",
  "facebook",
  "passport",
  "telegram",
  "twitter",
  "snapchat",
  "fivem",
  "discord-roblox",
]);

/** Plan-module slug for BreachHub specialty scopes (when moduleSlug is omitted). */
const SCOPE_MODULE_SLUG: Record<string, string> = {
  "google-docs": "google-docs",
  ganknow: "ganknow",
  passport: "passport",
  fivem: "fivem",
  facebook: "facebook-id",
  hwid: "hwid",
  xbox: "xbox",
  telegram: "telegram",
  twitter: "twitter",
  snapchat: "snapchat",
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const rawScope =
    req.nextUrl.searchParams.get("scope")?.trim() ||
    req.nextUrl.searchParams.get("endpoint")?.trim() ||
    "google-docs";
  const scopeAliases: Record<string, string> = {
    "facebook-id": "facebook",
    "oathnet-roblox": "discord-roblox",
  };
  const scope = scopeAliases[rawScope] || rawScope;

  const access = await requireOsintAccess(
    req,
    SCOPE_MODULE_SLUG[scope] ?? "breachhub",
  );

  if (access instanceof NextResponse) return access;

  if (!isBreachHubEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!ALLOWED_SCOPES.has(scope)) {
    return NextResponse.json(
      { error: "Unsupported BreachHub specialty scope." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchBreachHubSpecialty(scope, query, 20_000),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data || data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query,
        message: "No results were found.",
      });
    }

    return NextResponse.json({ ...data, query });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query },
    });
  }
}
