import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { PUBLIC_INTEL_SOURCE } from "@/lib/public-branding";
import { searchBanks } from "@/lib/bank-search";
import { fetchGodsEyeSearchSafe } from "@/lib/godseye";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "bank");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [fdic, godseye] = await Promise.all([
      searchBanks(query),
      fetchGodsEyeSearchSafe("bank", query),
    ]);

    const result = {
      ...fdic,
      godseye,
      sources: ["FDIC", ...(godseye ? [PUBLIC_INTEL_SOURCE] : [])],
    };

    if (result.banks.length === 0 && !godseye) {
      return NextResponse.json({
        ...result,
        message: "No US bank institutions matched that search.",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bank search failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
