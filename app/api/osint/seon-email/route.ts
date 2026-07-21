import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchSeonEmailWithFallback } from "@/lib/gateway-fallback";
import { normalizeEmail } from "@/lib/proxynova-comb";
import { publicSearchError } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "seon-email");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const email = normalizeEmail(query);

  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    // BreachHub SEON primary → CSINT fallback (never parallel).
    const data = await fetchSeonEmailWithFallback(email);

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
