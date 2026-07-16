import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintIpLookup } from "@/lib/csint";
import { fetchCombinedOsintCatEndpoint } from "@/lib/osint-combined";
import { normalizeIpSearchPayload } from "@/lib/ip-search";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "ip");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [data, csintIp] = await Promise.all([
      fetchCombinedOsintCatEndpoint("ip", query, "ip", "ip"),
      fetchCsintIpLookup(query),
    ]);

    const payload = normalizeIpSearchPayload(data);
    if (csintIp) {
      return NextResponse.json({
        ...payload,
        enrichment: csintIp,
      });
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    // Fall back to CSINT-only if other indexes fail
    const csintIp = await fetchCsintIpLookup(query);
    if (csintIp) {
      return NextResponse.json({
        query,
        enrichment: csintIp,
        sources: ["index"],
      });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
