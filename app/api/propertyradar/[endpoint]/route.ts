import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchPropertyRadarSanitized,
  isPropertyRadarEnabled,
  isPropertyRadarEndpoint,
  propertyRadarModuleSlugForEndpoint,
  type PropertyRadarEndpoint,
} from "@/lib/propertyradar";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ endpoint: string }>;
};

/**
 * GET /api/propertyradar/search
 * GET /api/propertyradar/persons
 * GET /api/propertyradar/phone
 * GET /api/propertyradar/email
 * GET /api/propertyradar/skiptrace
 *
 * Proxies PropertyRadar (direct PROPERTYRADAR_API_KEY / PROPERTY_RADAR_API_KEY)
 * or BreachHub /api/propertyradar/* while billing against the mapped plan module.
 * Accepts OpenAPI-style field names or a generic `query`.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { endpoint: rawEndpoint } = await context.params;
  const endpoint = rawEndpoint?.trim().toLowerCase() ?? "";

  if (!isPropertyRadarEndpoint(endpoint)) {
    return NextResponse.json(
      { error: "Unknown PropertyRadar endpoint." },
      { status: 404 },
    );
  }

  const prEndpoint = endpoint as PropertyRadarEndpoint;
  const defaultSlug = propertyRadarModuleSlugForEndpoint(prEndpoint);
  const access = await requireOsintAccess(req, `propertyradar/${prEndpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, defaultSlug);

      if (retry instanceof NextResponse) {
        const third = await requireOsintAccess(req, "propertyradar");

        if (third instanceof NextResponse) {
          const fourth = await requireOsintAccess(req, "contact-enrich");

          if (fourth instanceof NextResponse) return fourth;
        }
      }
    } else {
      return access;
    }
  }

  if (!isPropertyRadarEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  const hasQuery =
    Boolean(input.query) ||
    Boolean(input.address) ||
    Boolean(input.siteAddress) ||
    Boolean(input.name) ||
    Boolean(input.ownerName) ||
    Boolean(input.owner) ||
    Boolean(input.phone) ||
    Boolean(input.email) ||
    Boolean(input.personKey) ||
    Boolean(input.PersonKey) ||
    Boolean(input.radarId) ||
    Boolean(input.RadarID) ||
    Boolean(input.criteria);

  if (!hasQuery) {
    const hint =
      prEndpoint === "persons"
        ? "radarId, name, or query"
        : prEndpoint === "phone"
          ? "phone, personKey, or query"
          : prEndpoint === "email"
            ? "email, personKey, or query"
            : "query, address, name, phone, or email";

    return NextResponse.json(
      { error: `Missing ${hint}.` },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchPropertyRadarSanitized(prEndpoint, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        source: data.source,
        endpoint: prEndpoint,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint: prEndpoint,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: input.query || input.phone || input.email || input.name || "",
        endpoint: prEndpoint,
      },
    });
  }
}
