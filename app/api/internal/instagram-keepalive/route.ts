import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(provided: string, expected: string): boolean {
  const a = new Uint8Array(Buffer.from(provided));
  const b = new Uint8Array(Buffer.from(expected));

  if (a.length === 0 || a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.INSTAGRAM_CRON_SECRET?.trim();

  if (!expected) return false;
  const header =
    req.headers.get("x-anya-cron-secret")?.trim() ||
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    "";

  return secretsMatch(header, expected);
}

/**
 * Local cron / PM2 keep-alive for Instagram session cookies.
 * Auth: INSTAGRAM_CRON_SECRET via x-anya-cron-secret (or Bearer).
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ensureInstagramSession, probeInstagramSessionAlive } = await import(
      "@/lib/instagram-reauth"
    );

    const force = req.nextUrl.searchParams.get("force") === "1";

    const aliveBefore = await probeInstagramSessionAlive();

    if (aliveBefore && !force) {
      return NextResponse.json({
        ok: true,
        alive: true,
        refreshed: false,
        message: "Session already alive.",
      });
    }

    const result = await ensureInstagramSession({ force: true });
    const aliveAfter = await probeInstagramSessionAlive();

    // If a forced re-login hits checkpoint/2FA but the existing cookie is still
    // valid, keep serving — do not report the whole tool as down.
    const ok = aliveAfter || result.ok;

    return NextResponse.json({
      ok,
      alive: aliveAfter,
      refreshed: result.refreshed,
      message: result.message,
      loginOk: result.ok,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Instagram keep-alive failed",
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { probeInstagramSessionAlive } = await import(
      "@/lib/instagram-reauth"
    );
    const alive = await probeInstagramSessionAlive();

    return NextResponse.json({ ok: true, alive });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        alive: false,
        error: error instanceof Error ? error.message : "Probe failed",
      },
      { status: 502 },
    );
  }
}
