import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchSeekNowSanitized,
  isSeekNowEnabled,
  isSeekNowEndpoint,
  normalizeSeekNowPath,
  seekNowMethodForEndpoint,
  seekNowModuleSlugForEndpoint,
  type SeekNowEndpoint,
} from "@/lib/seeknow";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function collectInput(req: NextRequest): Promise<Record<string, string>> {
  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    try {
      const body = (await req.json()) as unknown;

      if (body && typeof body === "object" && !Array.isArray(body)) {
        for (const [key, value] of Object.entries(
          body as Record<string, unknown>,
        )) {
          if (typeof value === "string" && value.trim()) {
            input[key] = value.trim();
          } else if (
            (typeof value === "number" || typeof value === "boolean") &&
            String(value)
          ) {
            input[key] = String(value);
          }
        }
      }
    } catch {
      // Body optional — query params alone are enough.
    }
  }

  return input;
}

async function handleSeekNow(
  req: NextRequest,
  context: RouteContext,
) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeSeekNowPath(pathParts ?? []);

  if (!isSeekNowEndpoint(endpointPath)) {
    return NextResponse.json(
      { error: "Unknown SeekNow endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath as SeekNowEndpoint;
  const expected = seekNowMethodForEndpoint(endpoint);

  // POST endpoints also accept GET (query-string) for the module UI.
  if (expected === "GET" && req.method !== "GET") {
    return NextResponse.json(
      { error: `Use GET for /api/seeknow/${endpoint}.` },
      { status: 405 },
    );
  }

  if (
    expected === "POST" &&
    req.method !== "POST" &&
    req.method !== "GET"
  ) {
    return NextResponse.json(
      { error: `Use POST (or GET) for /api/seeknow/${endpoint}.` },
      { status: 405 },
    );
  }

  const defaultSlug = seekNowModuleSlugForEndpoint(endpoint);
  const access = await requireOsintAccess(req, `seeknow/${endpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, defaultSlug);

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isSeekNowEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input = await collectInput(req);

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: "Missing query." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchSeekNowSanitized(endpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data.query) {
      return NextResponse.json(
        { error: "Missing required SeekNow parameter." },
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
        query: input.query || input.email || input.username || "",
        endpoint,
      },
    });
  }
}

/**
 * GET /api/seeknow/<…>
 * Specialty lookups (discord, username, network, domain, gaming).
 * Also accepted for search/stealer as a query-string alias of POST.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  return handleSeekNow(req, context);
}

/**
 * POST /api/seeknow/search and /api/seeknow/stealer (OpenAPI primary).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  return handleSeekNow(req, context);
}
