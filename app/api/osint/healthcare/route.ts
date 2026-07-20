import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { searchHealthCareUs } from "@/lib/us-provider-directory";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "healthcare");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = searchHealthCareUs(query);

    if (result.providers.length === 0) {
      return NextResponse.json({
        ...result,
        message: "No US health care providers matched that search.",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Health care search failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
