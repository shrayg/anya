import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintIpLookup } from "@/lib/csint";
import { fetchCombinedOsintCatEndpoint } from "@/lib/osint-combined";
import { normalizeIpSearchPayload } from "@/lib/ip-search";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "ip");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [data, csintIp] = await withDeadline(
      Promise.all([
        fetchCombinedOsintCatEndpoint("ip", query, "ip", "ip").catch(() => null),
        fetchCsintIpLookup(query).catch(() => null),
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data) {
      const payload = normalizeIpSearchPayload(data);
      if (csintIp) {
        return NextResponse.json({
          ...payload,
          enrichment: csintIp,
        });
      }
      return NextResponse.json(payload);
    }

    if (csintIp) {
      return NextResponse.json({
        query,
        enrichment: csintIp,
        sources: ["index"],
      });
    }

    return NextResponse.json({
      query,
      message: "Nothing found for this IP.",
    });
  } catch (err) {
    try {
      const csintIp = await fetchCsintIpLookup(query);
      if (csintIp) {
        return NextResponse.json({
          query,
          enrichment: csintIp,
          sources: ["index"],
        });
      }
    } catch {
      // ignore secondary failure
    }

    return osintFailureResponse(err, {
      softEmpty: { query, message: "IP lookup timed out or failed." },
    });
  }
}
