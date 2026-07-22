import { NextRequest, NextResponse } from "next/server";

import {
  fetchCheckoSanitized,
  isCheckoEnabled,
} from "@/lib/checko";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/**
 * GET /api/checko?inn=… (also accepts ogrn|okpo|query)
 *
 * Proxies Checko Russian company / EGRUL lookup (direct CHECKO_API_KEY
 * or BreachHub). Optional `type=inn|ogrn|okpo` and `source=true`.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "checko");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "bank");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isCheckoEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("inn")?.trim() ||
    req.nextUrl.searchParams.get("ogrn")?.trim() ||
    req.nextUrl.searchParams.get("okpo")?.trim() ||
    req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing inn, ogrn, okpo, or query." },
      { status: 400 },
    );
  }

  const typeHint =
    req.nextUrl.searchParams.get("type")?.trim() ||
    (req.nextUrl.searchParams.get("inn") ? "inn" : null) ||
    (req.nextUrl.searchParams.get("ogrn") ? "ogrn" : null) ||
    (req.nextUrl.searchParams.get("okpo") ? "okpo" : null);

  const sourceRaw = req.nextUrl.searchParams.get("source")?.trim();
  const includeSource =
    sourceRaw === "true" || sourceRaw === "1" || sourceRaw === "yes";

  try {
    const data = await withDeadline(
      fetchCheckoSanitized(query, typeHint, { source: includeSource }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        idKind: data.idKind,
        idValue: data.idValue,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      idKind: data.idKind,
      idValue: data.idValue,
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
