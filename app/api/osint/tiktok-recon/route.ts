import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintTiktokRecon, flattenCsintEntity } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "tiktok-recon");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await fetchCsintTiktokRecon(query);
    const profile = flattenCsintEntity(data);

    if (!profile) {
      return NextResponse.json({
        query,
        count: 0,
        results: [],
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      query,
      count: 1,
      results: [profile],
      profile,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return osintFailureResponse(err instanceof Error ? err : new Error(String(message)));
  }
}
