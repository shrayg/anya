import { NextRequest, NextResponse } from "next/server";

import {
  fetchInstagramApiSanitized,
  isInstagramApiEnabled,
  normalizeInstagramApiQuery,
  pickInstagramProfileQuery,
} from "@/lib/instagram-api";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/**
 * GET /api/instagram?query=…
 *
 * Instagram OSINT profile lookup by username, @username, profile URL, email,
 * or phone (direct INSTAGRAM_API_KEY or BreachHub). Distinct from DataVoid
 * POST /api/datavoid/instagram and session export /api/osint/instagram.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "instagram");

  if (access instanceof NextResponse) return access;

  if (!isInstagramApiEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  const rawQuery = pickInstagramProfileQuery(input);

  if (!rawQuery) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const query = normalizeInstagramApiQuery(rawQuery);

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchInstagramApiSanitized("profile", query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        kind: data.kind,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      kind: data.kind,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        kind: "profile",
      },
    });
  }
}
