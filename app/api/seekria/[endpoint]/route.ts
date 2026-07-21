import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchSeekriaSanitized,
  isSeekriaEnabled,
  isSeekriaEndpoint,
  seekriaModuleSlugForEndpoint,
  type SeekriaEndpoint,
} from "@/lib/seekria";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ endpoint: string }>;
};

/**
 * GET /api/seekria/<endpoint>?query=…
 *
 * Proxies Seekria (direct SEEKRIA_API_KEY or BreachHub) while billing against
 * the mapped plan module via osint-api-auth defaults / moduleSlug.
 * Optional: type (fivem / tiktok-lookup), moduleSlug override.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { endpoint: rawEndpoint } = await context.params;
  const endpoint = rawEndpoint?.trim().toLowerCase() ?? "";

  if (!isSeekriaEndpoint(endpoint)) {
    return NextResponse.json(
      { error: "Unknown Seekria endpoint." },
      { status: 404 },
    );
  }

  const seekriaEndpoint = endpoint as SeekriaEndpoint;
  const defaultSlug = seekriaModuleSlugForEndpoint(seekriaEndpoint);
  const access = await requireOsintAccess(req, `seekria/${seekriaEndpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, defaultSlug);

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isSeekriaEnabled()) {
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
    req.nextUrl.searchParams.get("domain")?.trim() ||
    req.nextUrl.searchParams.get("phone")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const extra: Record<string, string> = {};
  const type = req.nextUrl.searchParams.get("type")?.trim();

  if (type) extra.type = type;

  try {
    const data = await withDeadline(
      fetchSeekriaSanitized(seekriaEndpoint, query, extra),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        source: data.source,
        endpoint: seekriaEndpoint,
        message: "No results were found.",
        ...(data.raw ? { raw: data.raw } : {}),
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint: seekriaEndpoint,
      ...(data.raw ? { raw: data.raw } : {}),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        endpoint: seekriaEndpoint,
      },
    });
  }
}
