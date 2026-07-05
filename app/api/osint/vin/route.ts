import { NextRequest, NextResponse } from "next/server";

import { decodeVin } from "@/lib/vin-decode";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await decodeVin(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "VIN decode failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
