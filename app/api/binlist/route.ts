import { NextRequest, NextResponse } from "next/server";

import { fetchBinlistSanitized, isBinlistEnabled } from "@/lib/binlist";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/** GET /api/binlist?bin=… (also accepts query) */
export async function GET(req: NextRequest) {
  let access = await requireOsintAccess(req, "binlist");

  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "bin");
  }
  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(req, "bin-lookup");
  }
  if (access instanceof NextResponse) return access;

  if (!isBinlistEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("bin")?.trim() ||
    req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing bin." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchBinlistSanitized(query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      bin: data.bin,
      source: data.source,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const lower = message.toLowerCase();

    if (
      lower.includes("enter the first") ||
      (lower.includes("bin") && lower.includes("digit"))
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query, bin: query },
    });
  }
}
