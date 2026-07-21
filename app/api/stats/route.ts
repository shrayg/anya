import { NextResponse } from "next/server";

import { getPlatformStats } from "@/lib/platform-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getPlatformStats();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
