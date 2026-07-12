import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCombinedOsintCatEndpoint } from "@/lib/osint-combined";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "dns");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await fetchCombinedOsintCatEndpoint(
      "dns-resolver",
      query,
      "domain",
    );
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
