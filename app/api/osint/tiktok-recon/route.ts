import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintTiktokRecon } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "tiktok-recon");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await fetchCsintTiktokRecon(query);
    if (!data) {
      return NextResponse.json(
        { error: publicSearchError("No TikTok profile found.") },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
