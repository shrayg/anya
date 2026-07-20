import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { searchCarInsuranceUs } from "@/lib/us-provider-directory";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "car-insurance");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = searchCarInsuranceUs(query);

    if (result.providers.length === 0) {
      return NextResponse.json({
        ...result,
        message: "No US car insurers matched that search.",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Car insurance search failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
