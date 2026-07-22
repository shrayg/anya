import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import { fetchNbrsRobloxSanitized, isNbrsEnabled } from "@/lib/nbrs";

export const maxDuration = 60;

/** GET /api/nbrs/roblox?username=…|playerid=…|query=… */
export async function GET(req: NextRequest) {
  let access = await requireOsintAccess(req, "nbrs/roblox");
  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "roblox");
  }
  if (access instanceof NextResponse) return access;
  if (!isNbrsEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }
  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("playerid")?.trim() ||
    req.nextUrl.searchParams.get("user_id")?.trim() ||
    req.nextUrl.searchParams.get("id")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing username or playerid." },
      { status: 400 },
    );
  }
  try {
    const data = await withDeadline(
      fetchNbrsRobloxSanitized(query),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query },
    });
  }
}
