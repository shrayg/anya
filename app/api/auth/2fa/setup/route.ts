import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { siteConfig } from "@/config/site";
import {
  createSetupPendingToken,
  generateTotpSecret,
  getOtpauthUrl,
} from "@/lib/two-factor";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

/**
 * Start TOTP enrollment. Returns otpauth URL + pending token.
 * Secret is NOT persisted until verify succeeds.
 */
export async function POST() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled" },
      { status: 400 },
    );
  }

  const secret = generateTotpSecret();
  const pendingToken = await createSetupPendingToken(session.userId, secret);
  const otpauthUrl = getOtpauthUrl(secret, user.username);

  return NextResponse.json({
    ok: true,
    pendingToken,
    otpauthUrl,
    secret,
    issuer: siteConfig.name,
  });
}
