import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintSeonPhone } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";

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
    const data = await fetchCsintSeonPhone(query);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
