import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchBreachHubSpecialty } from "@/lib/breachhub";
import { fetchCsintSeonPhone } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "seon-phone");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const digits = query.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json(
      { error: "Enter a valid phone number (10–15 digits)." },
      { status: 400 },
    );
  }

  try {
    const [csint, breachHub] = await Promise.all([
      fetchCsintSeonPhone(query).catch(() => null),
      fetchBreachHubSpecialty("phone", query).catch(() => null),
    ]);

    if (csint) {
      return NextResponse.json({
        ...csint,
        ...(breachHub && breachHub.count > 0 ? { indexHits: breachHub } : {}),
      });
    }

    if (breachHub && breachHub.count > 0) {
      return NextResponse.json({ query, indexHits: breachHub });
    }

    throw new Error(publicSearchError());
  } catch (err) {
    const message = err instanceof Error ? err.message : publicSearchError();

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
