import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { consumeRateLimit } from "@/lib/simple-rate-limit";
import { claimSearchResultVault } from "@/lib/search-result-vault";

export async function POST(req: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to unlock results." }, { status: 401 });
  }

  const rate = consumeRateLimit(
    `vault-claim:${session.userId}`,
    30,
    60 * 60 * 1000,
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many unlock attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const vaultId =
    typeof body.vaultId === "string" ? body.vaultId.trim() : "";
  const claimToken =
    typeof body.claimToken === "string" ? body.claimToken.trim() : "";
  const preferCreditUnlock = Boolean(body.preferCreditUnlock);

  if (!vaultId || !claimToken) {
    return NextResponse.json(
      { error: "Missing vaultId or claimToken." },
      { status: 400 },
    );
  }

  const result = await claimSearchResultVault({
    vaultId,
    claimToken,
    userId: session.userId as number,
    preferCreditUnlock,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        requiresBalance: result.requiresBalance ?? false,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    moduleSlug: result.moduleSlug,
    chargedCredits: result.chargedCredits,
    blurResults: false,
    teaser: false,
    payload: result.payload,
  });
}
