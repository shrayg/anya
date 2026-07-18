import { NextResponse } from "next/server";

import { getPublicStatus, type PublicStatusPayload } from "@/lib/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedStatus = {
  expiresAt: number;
  payload: PublicStatusPayload;
};

let cache: CachedStatus | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return NextResponse.json(
      { ...cache.payload, cached: true },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
        },
      },
    );
  }

  const payload = await getPublicStatus({ cached: false });

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
    },
  });
}
