import { NextRequest, NextResponse } from "next/server";

import {
  fetchMedalSanitized,
  isMedalEnabled,
  isMedalType,
} from "@/lib/medal";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/**
 * GET /api/medal?username=… (also accepts query|id)
 *
 * Proxies Medal.tv profile lookup (direct MEDAL_API_KEY or BreachHub).
 * Optional `type=username` (default).
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "medal");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "username");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isMedalEnabled()) {
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

  const typeRaw = req.nextUrl.searchParams.get("type")?.trim() ?? null;

  if (typeRaw && !isMedalType(typeRaw)) {
    return NextResponse.json(
      { error: "Invalid type. Use username." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchMedalSanitized(username, typeRaw),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        username: data.username,
        type: data.type,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      username: data.username,
      type: data.type,
      source: data.source,
      ...(data.profile ? { profile: data.profile } : {}),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: username,
        username,
        type: typeRaw && isMedalType(typeRaw) ? typeRaw : "username",
      },
    });
  }
}
