import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchCombinedOsintCatEndpoint } from "@/lib/osint-combined";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "dns");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchCombinedOsintCatEndpoint("dns-resolver", query, "domain"),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json(data);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        query,
        results: [],
        message: "DNS lookup timed out or failed.",
      },
    });
  }
}
