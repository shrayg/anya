import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchWentynSanitized,
  isWentynEnabled,
  isWentynType,
} from "@/lib/wentyn";

export const maxDuration = 60;

/**
 * GET /api/wentyn?query=…&type=email|domain
 *
 * Proxies Wentyn stealer logs (direct WENTYN_API_KEY or BreachHub).
 * `type` is optional — inferred from the query when omitted.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "wentyn");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "stealer-logs");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isWentynEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("domain")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const typeRaw = req.nextUrl.searchParams.get("type")?.trim() ?? null;

  if (typeRaw && !isWentynType(typeRaw)) {
    return NextResponse.json(
      { error: "Invalid type. Use email or domain." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchWentynSanitized(query, typeRaw),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        type: data.type,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      type: data.type,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        type: typeRaw && isWentynType(typeRaw) ? typeRaw : undefined,
      },
    });
  }
}
