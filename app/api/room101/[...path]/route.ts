import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchRoom101Sanitized,
  isRoom101Enabled,
  isRoom101Endpoint,
  normalizeRoom101Path,
  room101ModuleSlugForEndpoint,
  type Room101Endpoint,
} from "@/lib/room101";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * GET /api/room101/<analyze|search|v2/search|user|subreddit>?…
 *
 * Proxies Room101 (direct ROOM101_API_KEY or BreachHub) while billing against
 * the reddit plan module. Accepts OpenAPI params or a generic `query`.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeRoom101Path(pathParts ?? []);

  if (!isRoom101Endpoint(endpointPath)) {
    return NextResponse.json(
      { error: "Unknown Room101 endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath as Room101Endpoint;
  const defaultSlug = room101ModuleSlugForEndpoint(endpoint);
  const access = await requireOsintAccess(req, `room101/${endpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, defaultSlug);

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isRoom101Enabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  if (
    !input.query &&
    !input.username &&
    !input.name &&
    !input.subreddit &&
    !input.term &&
    !input.terms &&
    !input.q
  ) {
    return NextResponse.json(
      {
        error:
          endpoint === "subreddit"
            ? "Missing name (or query)."
            : endpoint === "search" || endpoint === "v2/search"
              ? "Missing query."
              : "Missing username (or query).",
      },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchRoom101Sanitized(endpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data.query) {
      return NextResponse.json(
        { error: "Missing required Room101 parameter." },
        { status: 400 },
      );
    }

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        source: data.source,
        endpoint,
        message: "No results were found.",
        ...(data.raw ? { raw: data.raw } : {}),
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint,
      ...(data.raw ? { raw: data.raw } : {}),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query:
          input.query ||
          input.username ||
          input.name ||
          input.subreddit ||
          "",
        endpoint,
      },
    });
  }
}
