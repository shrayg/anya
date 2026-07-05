import { NextRequest, NextResponse } from "next/server";

import { lookupIban } from "@/lib/iban-lookup";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await lookupIban(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "IBAN lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
