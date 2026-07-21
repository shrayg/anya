import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchSeonPhoneWithFallback } from "@/lib/gateway-fallback";
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
    // BreachHub SEON primary → CSINT fallback (never parallel).
    const data = await fetchSeonPhoneWithFallback(query);

    if (!data) {
      throw new Error(publicSearchError());
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : publicSearchError();

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
