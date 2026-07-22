import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchSnapchatSanitized,
  isSnapchatEnabled,
  normalizeSnapchatUsername,
} from "@/lib/snapchat";

export const maxDuration = 60;

/**
 * GET /api/snapchat?query=…
 *
 * Proxies Snapchat OSINT (direct SNAPCHAT_API_KEY or BreachHub).
 * Also accepts `username` / `user` and snapchat.com/add/… URLs.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "snapchat");

  if (access instanceof NextResponse) return access;

  if (!isSnapchatEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const rawQuery =
    sp.get("query")?.trim() ||
    sp.get("username")?.trim() ||
    sp.get("user")?.trim();

  if (!rawQuery) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const query = normalizeSnapchatUsername(rawQuery);

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchSnapchatSanitized(query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
      },
    });
  }
}
