import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintShodanHost } from "@/lib/csint";
import { publicSearchError } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "shodan-host");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(query) && !query.includes(":")) {
    return NextResponse.json(
      { error: "Enter an IPv4 or IPv6 address." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchCsintShodanHost(query);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
