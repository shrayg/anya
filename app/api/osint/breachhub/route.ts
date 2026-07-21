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

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breachhub");

  if (access instanceof NextResponse) return access;

  if (!isBreachHubEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

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
