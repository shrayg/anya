import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { isBreachHubEnabled } from "@/lib/breachhub";
import { isCsintEnabled } from "@/lib/csint";
import { fetchMelissaWithFallback } from "@/lib/gateway-fallback";
import { publicSearchError } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

/**
 * Contact enrichment — free-form name/email/phone/address in `query`,
 * or structured fields via query params: first, last, email, phone, city, state, postal.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "contact-enrich");

  if (access instanceof NextResponse) return access;

  const params = req.nextUrl.searchParams;
  const query = params.get("query")?.trim();

  const body: Record<string, string> = {};

  for (const key of [
    "first",
    "last",
    "email",
    "phone",
    "a1",
    "a2",
    "city",
    "state",
    "postal",
    "comp",
  ]) {
    const value = params.get(key)?.trim();

    if (value) body[key] = value;
  }

  if (query && Object.keys(body).length === 0) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) {
      body.email = query;
    } else if (
      /^[\d\s+\-().]+$/.test(query) &&
      query.replace(/\D/g, "").length >= 10
    ) {
      body.phone = query;
    } else {
      body.input = query;
    }
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      {
        error: "Enter a name, email, phone, or address to enrich.",
      },
      { status: 400 },
    );
  }

  if (!isBreachHubEnabled() && !isCsintEnabled()) {
    return NextResponse.json({ error: publicSearchError() }, { status: 503 });
  }

  try {
    // BreachHub Melissa primary → CSINT fallback (never parallel).
    const data = await fetchMelissaWithFallback(body);

    if (!data) {
      return NextResponse.json({ count: 0, results: [] });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : publicSearchError();

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
