import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import {
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCodes,
  verifySetupPendingToken,
  verifyTotpCode,
} from "@/lib/two-factor";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

/** Confirm setup with a TOTP code; enable 2FA and return backup codes once. */
export async function POST(request: Request) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pendingToken =
    typeof body?.pendingToken === "string" ? body.pendingToken : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!pendingToken || !code) {
    return NextResponse.json(
      { error: "Pending token and authenticator code are required" },
      { status: 400 },
    );
  }

  const pending = await verifySetupPendingToken(pendingToken);

  if (!pending || pending.userId !== session.userId) {
    return NextResponse.json(
      { error: "Setup session expired. Start again." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, twoFactorEnabled: true },
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

  if (!verifyTotpCode(pending.secret, user.username, code)) {
    return NextResponse.json(
      { error: "Invalid authenticator code" },
      { status: 400 },
    );
  }

  const backupCodes = generateBackupCodes();
  const backupHashes = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptTotpSecret(pending.secret),
      twoFactorVerifiedAt: new Date(),
      twoFactorBackupCodes: backupHashes,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Two-factor authentication enabled",
    backupCodes,
  });
}
