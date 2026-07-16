import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { searchSanctionsWatchlists } from "@/lib/us-records";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "us-sanctions");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    return NextResponse.json(await searchSanctionsWatchlists(query));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sanctions search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
