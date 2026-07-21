import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  classifyNotaliveXSegment,
  fetchNotaliveXLookup,
  isNotaliveXEnabled,
  isNotaliveXType,
} from "@/lib/notalivex";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

type RouteParams = {
  params: Promise<{ segment: string; type: string }>;
};

/**
 * NotaliveX country + platform lookups share this two-segment dynamic path:
 *   /api/notalivex/{country}/{type}
 *   /api/notalivex/{platform}/{type}
 *
 * Static /api/notalivex/ar_rena/renaper takes precedence for Renaper.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const access = await requireOsintAccess(req, "notalivex");

  if (access instanceof NextResponse) return access;

  if (!isNotaliveXEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const { segment: rawSegment, type: rawType } = await params;
  const segment = rawSegment?.trim().toLowerCase() ?? "";
  const type = rawType?.trim().toLowerCase() ?? "";

  if (!segment || !type) {
    return NextResponse.json(
      { error: "Missing country/platform or type" },
      { status: 400 },
    );
  }

  if (segment === "ar_rena") {
    return NextResponse.json(
      {
        error:
          "Use /api/notalivex/ar_rena/renaper with dni and sexo query params",
      },
      { status: 400 },
    );
  }

  const kind = classifyNotaliveXSegment(segment);

  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported NotaliveX country or platform" },
      { status: 400 },
    );
  }

  if (!isNotaliveXType(type)) {
    return NextResponse.json(
      { error: "Unsupported NotaliveX lookup type" },
      { status: 400 },
    );
  }

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchNotaliveXLookup(segment, type, query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data || data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query,
        segment,
        type,
        kind,
        message: "No results were found.",
      });
    }

    return NextResponse.json({ ...data, query, segment, type, kind });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query, segment, type, kind },
    });
  }
}
