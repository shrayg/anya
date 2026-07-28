import { NextRequest, NextResponse } from "next/server";

import { lookupIpInfo } from "@/lib/ipinfo";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export const maxDuration = 60;

/**
 * GET /api/ipinfo?ip=… (also accepts query)
 *
 * IP geolocation / ASN — IPInfo or BreachHub when configured, otherwise a
 * free HTTPS fallback so map + location still work.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "ipinfo");

  if (access instanceof NextResponse) return access;

  const query =
    req.nextUrl.searchParams.get("ip")?.trim() ||
    req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing ip." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      lookupIpInfo(query, 15_000),
      Math.min(OSINT_ROUTE_DEADLINE_MS, 20_000),
    );

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "IPInfo lookup failed";
    const lower = message.toLowerCase();

    if (
      lower.includes("valid") ||
      lower.includes("missing") ||
      lower.includes("enter a")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: {
        ip: query,
        message: "No results were found.",
      },
    });
  }
}
