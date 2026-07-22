import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import { isVinEnabled, lookupVin } from "@/lib/vin";

export const maxDuration = 60;

/**
 * GET /api/vin?vin=… (also accepts query)
 *
 * NHTSA VIN decode + optional BreachHub / direct VIN index enrichment.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "vin");

  if (access instanceof NextResponse) return access;

  if (!isVinEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("vin")?.trim() ||
    req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing vin." }, { status: 400 });
  }

  try {
    const data = await withDeadline(lookupVin(query), OSINT_ROUTE_DEADLINE_MS);

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "VIN decode failed";
    const lower = message.toLowerCase();

    if (
      lower.includes("valid") ||
      lower.includes("missing") ||
      lower.includes("enter a") ||
      lower.includes("no vehicle")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: {
        vin: query,
        fields: {},
        decodeSource: "nhtsa",
        message: "No results were found.",
      },
    });
  }
}
