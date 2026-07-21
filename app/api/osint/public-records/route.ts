import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { parsePublicRecordsSources } from "@/lib/public-records/source-options";
import { searchUnifiedPublicRecords } from "@/lib/us-records/unified";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "public-records");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Enter a first and last name to search." },
      { status: 400 },
    );
  }

  const sources = parsePublicRecordsSources(
    req.nextUrl.searchParams.get("sources"),
  );

  try {
    return NextResponse.json(await searchUnifiedPublicRecords(query, sources));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Public records search failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
