import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchReconlySanitized,
  isReconlyEnabled,
  isReconlyMode,
} from "@/lib/reconly";

export const maxDuration = 60;

/**
 * GET /api/reconly?query=…&mode=discord|username|email|fivem
 *
 * Proxies Reconly OSINT (direct RECONLY_API_KEY or BreachHub).
 * `mode` is optional — inferred from the query / moduleSlug when omitted.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "reconly");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "discord");

      if (retry instanceof NextResponse) {
        const fivemRetry = await requireOsintAccess(req, "fivem");

        if (fivemRetry instanceof NextResponse) return fivemRetry;
      }
    } else {
      return access;
    }
  }

  if (!isReconlyEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("discord")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const modeRaw = req.nextUrl.searchParams.get("mode")?.trim() ?? null;

  if (modeRaw && !isReconlyMode(modeRaw)) {
    return NextResponse.json(
      { error: "Invalid mode. Use discord, username, email, or fivem." },
      { status: 400 },
    );
  }

  const scope =
    req.nextUrl.searchParams.get("moduleSlug")?.trim() ||
    req.nextUrl.searchParams.get("scope")?.trim() ||
    null;

  try {
    const data = await withDeadline(
      fetchReconlySanitized(query, modeRaw, scope),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        mode: data.mode,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      mode: data.mode,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        mode: modeRaw && isReconlyMode(modeRaw) ? modeRaw : undefined,
      },
    });
  }
}
