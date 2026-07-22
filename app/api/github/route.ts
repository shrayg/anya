import { NextRequest, NextResponse } from "next/server";

import { fetchGithubSanitized, isGithubEnabled } from "@/lib/github";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/** GET /api/github?username=…|email=…|query=… */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "github");

  if (access instanceof NextResponse) return access;

  if (!isGithubEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing username or email." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchGithubSanitized(query),
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
