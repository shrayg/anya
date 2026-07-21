import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchBreachHubSpecialty } from "@/lib/breachhub";
import { decodeVin } from "@/lib/vin-decode";
import { PUBLIC_INTEL_SOURCE } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "vin");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [result, breachHub] = await Promise.all([
      decodeVin(query),
      fetchBreachHubSpecialty("vin", query).catch(() => null),
    ]);

    return NextResponse.json({
      ...result,
      ...(breachHub && breachHub.count > 0
        ? { indexHits: breachHub, sources: [PUBLIC_INTEL_SOURCE] }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "VIN decode failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
