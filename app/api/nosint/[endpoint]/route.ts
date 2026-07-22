import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchNosintSanitized,
  isNosintEnabled,
  isNosintEndpoint,
  type NosintEndpoint,
} from "@/lib/nosint";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ endpoint: string }> };

/** GET /api/nosint/search | /api/nosint/ip */
export async function GET(req: NextRequest, context: RouteContext) {
  const endpoint = (await context.params).endpoint?.trim().toLowerCase() ?? "";
  if (!isNosintEndpoint(endpoint)) {
    return NextResponse.json(
      { error: "Unknown Nosint endpoint." },
      { status: 404 },
    );
  }
  const nosintEndpoint = endpoint as NosintEndpoint;
  let access = await requireOsintAccess(req, `nosint/${nosintEndpoint}`);
  if (access instanceof NextResponse && access.status === 400) {
    access = await requireOsintAccess(
      req,
      nosintEndpoint === "ip" ? "ip" : "breaches",
    );
  }
  if (access instanceof NextResponse) return access;
  if (!isNosintEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }
  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("ip")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("phone")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  const typeHint = req.nextUrl.searchParams.get("type")?.trim() ?? null;
  try {
    const data = await withDeadline(
      fetchNosintSanitized(nosintEndpoint, query, typeHint),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint: nosintEndpoint,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("enter an ip")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query, endpoint: nosintEndpoint },
    });
  }
}
