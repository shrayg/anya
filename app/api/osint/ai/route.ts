import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { resolveAiMode, runAiIntel, type AiMode } from "@/lib/ai-intel";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "ai");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query");
  const modeParam = req.nextUrl.searchParams.get("mode");

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const mode = resolveAiMode(modeParam, query) as AiMode;
  const apiKey = process.env.OSINTCAT_API_KEY;

  try {
    const result = await runAiIntel(query, mode, apiKey);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }
}
