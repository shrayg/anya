import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { searchUsIdentity } from "@/lib/us-records";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "us-identity");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await searchUsIdentity(query, { includeCourt: true });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Identity search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
