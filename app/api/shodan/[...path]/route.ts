import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchShodanSanitized,
  isShodanEnabled,
  isShodanEndpoint,
  normalizeShodanPath,
  type ShodanEndpoint,
} from "@/lib/shodan";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * GET /api/shodan/host
 * GET /api/shodan/search
 * GET /api/shodan/dns
 * GET /api/shodan/dns/resolve
 * GET /api/shodan/dns/reverse
 * GET /api/shodan/honeyscore
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeShodanPath(pathParts ?? []);

  if (!isShodanEndpoint(endpointPath)) {
    return NextResponse.json(
      { error: "Unknown Shodan endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath as ShodanEndpoint;
  let access = await requireOsintAccess(req, `shodan/${endpoint}`);

  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "shodan-host");
  }
  if (access instanceof NextResponse) return access;

  if (!isShodanEnabled()) {
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
      fetchShodanSanitized(endpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data.query) {
      return NextResponse.json(
        { error: "Missing required Shodan parameter." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint,
      ...(data.raw ? { raw: data.raw } : {}),
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message.toLowerCase().includes("enter an ip")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: input.query || input.ip || "",
        endpoint,
      },
    });
  }
}
