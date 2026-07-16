import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { searchUsVaSor } from "@/lib/us-records";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "us-va-sor");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await searchUsVaSor(query);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Virginia Sex Offender Registry search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
