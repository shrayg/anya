import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { lookupVin } from "@/lib/vin";

/** Legacy alias — prefer GET /api/vin. */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "vin");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await withDeadline(
      lookupVin(query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "VIN decode failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
