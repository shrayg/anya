import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  detectCsintSearchType,
  fetchCsintBreachBase,
  isCsintEnabled,
} from "@/lib/csint";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breachbase");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!isCsintEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 502 },
    );
  }

  try {
    const searchType = detectCsintSearchType(query);
    const data = await fetchCsintBreachBase(query, searchType);

    if (!data || data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        message: "No results were found.",
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
