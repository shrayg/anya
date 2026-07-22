import { NextRequest, NextResponse } from "next/server";

import {
  fetchInstagramApiSanitized,
  isInstagramApiEnabled,
  isInstagramNumericId,
  pickInstagramIdQuery,
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
 * GET /api/instagram/id?query=…
 *
 * Instagram OSINT lookup by numeric user ID (5–20 digits). Proxies direct
 * INSTAGRAM_API_KEY or BreachHub. Separate from DataVoid POST
 * /api/datavoid/instagram.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "instagram/id");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "instagram");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

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

  const rawQuery = pickInstagramIdQuery(input);

  if (!rawQuery) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const query = rawQuery.trim();

  if (!isInstagramNumericId(query)) {
    return NextResponse.json(
      { error: "Enter a valid Instagram user ID (5–20 digits)." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchInstagramApiSanitized("id", query),
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
    const message = err instanceof Error ? err.message : String(err);

    if (/valid Instagram user ID/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        kind: "id",
      },
    });
  }
}
