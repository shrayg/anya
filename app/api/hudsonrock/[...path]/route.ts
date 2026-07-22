import { NextRequest, NextResponse } from "next/server";

import {
  fetchHudsonRockSanitized,
  hudsonRockModuleSlugForEndpoint,
  isHudsonRockEnabled,
  isHudsonRockEndpoint,
  normalizeHudsonRockPath,
  type HudsonRockEndpoint,
} from "@/lib/hudsonrock";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * GET /api/hudsonrock/search-by-domain
 * GET /api/hudsonrock/search-by-domain/overview|assessment|discovery
 * GET /api/hudsonrock/search-by-login/emails|usernames
 * GET /api/hudsonrock/search-by-ip
 * GET /api/hudsonrock/search-by-keyword[/urls]
 * GET /api/hudsonrock/search-by-stealer/infection-analysis
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeHudsonRockPath(pathParts ?? []);

  if (!isHudsonRockEndpoint(endpointPath)) {
    return NextResponse.json(
      { error: "Unknown Hudson Rock endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath as HudsonRockEndpoint;
  const fallback = hudsonRockModuleSlugForEndpoint(endpoint);
  let access = await requireOsintAccess(req, `hudsonrock/${endpoint}`);

  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, fallback);
  }
  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "stealer-logs");
  }
  if (access instanceof NextResponse) return access;

  if (!isHudsonRockEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchHudsonRockSanitized(endpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data.query) {
      return NextResponse.json(
        { error: "Missing required Hudson Rock parameter." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: input.query || input.domain || input.email || "",
        endpoint,
      },
    });
  }
}
