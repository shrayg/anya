import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  detectLeaksightType,
  fetchLeaksightSanitized,
  isLeaksightEnabled,
  isLeaksightType,
} from "@/lib/leaksight";

export const maxDuration = 60;

/** GET /api/leaksight?query=…&type=email|username|password|number|ip|… */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "leaksight");
  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "breaches");
      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }
  if (!isLeaksightEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }
  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("ip")?.trim() ||
    req.nextUrl.searchParams.get("phone")?.trim() ||
    req.nextUrl.searchParams.get("domain")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  const typeRaw = req.nextUrl.searchParams.get("type")?.trim() ?? null;
  if (
    typeRaw &&
    !isLeaksightType(typeRaw) &&
    !["phone", "domain", "subdomain"].includes(typeRaw.toLowerCase())
  ) {
    return NextResponse.json(
      { error: "Invalid LeakSight type." },
      { status: 400 },
    );
  }
  try {
    const data = await withDeadline(
      fetchLeaksightSanitized(query, typeRaw),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      type: data.type,
      source: data.source,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        type: detectLeaksightType(query, typeRaw),
      },
    });
  }
}
