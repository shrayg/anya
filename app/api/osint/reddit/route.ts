import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintReddit } from "@/lib/csint";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import { PUBLIC_INTEL_SOURCE } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "reddit");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [indexData, profile] = await Promise.all([
      fetchGodsEyeOnlySearch(query, "reddit").catch(() => ({
        count: 0,
        results: [] as unknown[],
      })),
      fetchCsintReddit(query),
    ]);

    if (profile) {
      return NextResponse.json({
        ...indexData,
        profile,
        source: PUBLIC_INTEL_SOURCE,
      });
    }

    if (indexData.count === 0) {
      return NextResponse.json({
        ...indexData,
        message: "No results were found.",
      });
    }

    return NextResponse.json(indexData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
