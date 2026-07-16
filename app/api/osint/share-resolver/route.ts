import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintShareResolver } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";

function detectSharePlatform(
  url: string,
): "instagram" | "tiktok" | null {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    return "instagram";
  }
  if (
    lower.includes("tiktok.com") ||
    lower.includes("vm.tiktok.com") ||
    lower.includes("vt.tiktok.com")
  ) {
    return "tiktok";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "share-resolver");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const platform = detectSharePlatform(query);
  if (!platform) {
    return NextResponse.json(
      {
        error:
          "Paste an Instagram reel share link (?igsh=) or a TikTok short link (vm/vt.tiktok.com).",
      },
      { status: 400 },
    );
  }

  try {
    const data = await fetchCsintShareResolver(platform, query);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
