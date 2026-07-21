import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchBreachHubSpecialty } from "@/lib/breachhub";
import { fetchCsintSeonEmail } from "@/lib/csint";
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
    const [csint, breachHub] = await Promise.all([
      fetchCsintSeonEmail(email).catch(() => null),
      fetchBreachHubSpecialty("email", email).catch(() => null),
    ]);

    if (csint) {
      return NextResponse.json({
        ...csint,
        ...(breachHub && breachHub.count > 0 ? { indexHits: breachHub } : {}),
      });
    }

    if (breachHub && breachHub.count > 0) {
      return NextResponse.json({ email, indexHits: breachHub });
    }

    throw new Error(publicSearchError());
  } catch (err) {
    const message = err instanceof Error ? err.message : publicSearchError();

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
