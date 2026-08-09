import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchSnusbaseSanitized,
  isSnusbaseEnabled,
  isSnusbaseEndpoint,
  normalizeSnusbasePath,
  type SnusbaseEndpoint,
} from "@/lib/snusbase-search";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const ACCESS_FALLBACK: Record<SnusbaseEndpoint, string> = {
  search: "breaches",
  "combo-lookup": "breaches",
  "hash-lookup": "hash-lookup",
  "ip-whois": "ip-whois",
};

/**
 * GET /api/snusbase/combo-lookup|hash-lookup|ip-whois?query=…
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeSnusbasePath(pathParts ?? []);

  if (!isSnusbaseEndpoint(endpointPath) || endpointPath === "search") {
    return NextResponse.json(
      { error: "Unknown Snusbase endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath;
  const access = await requireOsintAccess(req, `snusbase/${endpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, ACCESS_FALLBACK[endpoint]);

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isSnusbaseEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("ip")?.trim() ||
    req.nextUrl.searchParams.get("hash")?.trim() ||
    req.nextUrl.searchParams.get("password")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const typeHint = req.nextUrl.searchParams.get("type")?.trim() || null;

  try {
    const data = await withDeadline(
      fetchSnusbaseSanitized(endpoint, query, typeHint),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      type: data.type,
      source: data.source,
      endpoint: data.endpoint,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        endpoint,
      },
    });
  }
}
