import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchMemoryLolSanitized,
  isMemoryLolEnabled,
} from "@/lib/memorylol";

export const maxDuration = 60;

/**
 * GET /api/memory?username=… (also accepts query|id)
 *
 * Proxies Memory.lol X/Twitter username history (direct MEMORY_API_KEY
 * or BreachHub).
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "memory");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "twitter");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isMemoryLolEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const username =
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("id")?.trim();

  if (!username) {
    return NextResponse.json(
      { error: "Missing username." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchMemoryLolSanitized(username),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        username: data.username,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      username: data.username,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: username,
        username,
      },
    });
  }
}
