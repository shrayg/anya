import { NextRequest, NextResponse } from "next/server";

import {
  datavoidMethodForEndpoint,
  datavoidModuleSlugForEndpoint,
  fetchDatavoidSanitized,
  isDatavoidEnabled,
  isDatavoidEndpoint,
  normalizeDatavoidPath,
  type DatavoidEndpoint,
} from "@/lib/datavoid";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

async function collectInput(req: NextRequest): Promise<Record<string, string>> {
  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  if (req.method === "POST") {
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

async function handleDatavoid(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const endpointPath = normalizeDatavoidPath(pathParts ?? []);

  if (!isDatavoidEndpoint(endpointPath)) {
    return NextResponse.json(
      { error: "Unknown DataVoid endpoint." },
      { status: 404 },
    );
  }

  const endpoint = endpointPath as DatavoidEndpoint;
  const expected = datavoidMethodForEndpoint(endpoint);

  if (expected === "GET" && req.method !== "GET") {
    return NextResponse.json(
      { error: `Use GET for /api/datavoid/${endpoint}.` },
      { status: 405 },
    );
  }

  // POST OpenAPI endpoints also accept GET (query-string) for the module UI.
  if (
    expected === "POST" &&
    req.method !== "POST" &&
    req.method !== "GET"
  ) {
    return NextResponse.json(
      { error: `Use POST (or GET) for /api/datavoid/${endpoint}.` },
      { status: 405 },
    );
  }

  const fallback = datavoidModuleSlugForEndpoint(endpoint);
  let access = await requireOsintAccess(req, `datavoid/${endpoint}`);

  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, fallback);
  }
  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "datavoid");
  }
  if (access instanceof NextResponse) return access;

  if (!isDatavoidEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input = await collectInput(req);

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchDatavoidSanitized(endpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data.query) {
      return NextResponse.json(
        { error: "Missing required DataVoid parameter." },
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
        query: input.query || input.q || input.address || "",
        endpoint,
      },
    });
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  return handleDatavoid(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handleDatavoid(req, context);
}
