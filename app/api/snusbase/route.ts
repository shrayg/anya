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
} from "@/lib/snusbase-search";

export const maxDuration = 60;

/**
 * GET /api/snusbase?query=…
 *
 * Credential Index — primary Snusbase breach lookup (direct key, BreachHub,
 * or CSINT fallback).
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "snusbase");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "breaches");

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

  const typeHint =
    req.nextUrl.searchParams.get("type")?.trim() ||
    req.nextUrl.searchParams.get("scope")?.trim() ||
    null;

  try {
    const data = await withDeadline(
      fetchSnusbaseSanitized("search", query, typeHint),
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
        endpoint: "search",
      },
    });
  }
}
