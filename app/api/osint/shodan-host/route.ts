import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { isBreachHubEnabled } from "@/lib/breachhub";
import { isCsintEnabled } from "@/lib/csint";
import { fetchShodanHostWithFallback } from "@/lib/gateway-fallback";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicSearchError } from "@/lib/public-branding";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "shodan-host");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(query) && !query.includes(":")) {
    return NextResponse.json(
      { error: "Enter an IPv4 or IPv6 address." },
      { status: 400 },
    );
  }

  if (!isBreachHubEnabled() && !isCsintEnabled()) {
    return NextResponse.json({ error: publicSearchError() }, { status: 503 });
  }

  try {
    // BreachHub primary → CSINT fallback (never parallel).
    const data = await withDeadline(
      fetchShodanHostWithFallback(query),
      OSINT_ROUTE_DEADLINE_MS,
      "Host exposure lookup timed out. Try again.",
    );

    const ports = Array.isArray(data.ports) ? data.ports : [];
    const hostnames = Array.isArray(data.hostnames) ? data.hostnames : [];
    const services = Array.isArray(data.services) ? data.services : [];

    if (ports.length === 0 && hostnames.length === 0 && services.length === 0) {
      return NextResponse.json({
        ...data,
        message: "Nothing found for this IP in the host exposure index.",
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        query,
        ip: query,
        ports: [],
        org: null,
        hostnames: [],
        vulns: [],
        services: [],
      },
      fallbackMessage: publicSearchError(),
    });
  }
}
