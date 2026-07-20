import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      twoFactorEnabled: true,
      twoFactorVerifiedAt: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let backupCodesRemaining = 0;

  if (user.twoFactorBackupCodes) {
    try {
      const parsed = JSON.parse(user.twoFactorBackupCodes) as unknown;

      backupCodesRemaining = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      backupCodesRemaining = 0;
    }
  }

  return NextResponse.json({
    ok: true,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorVerifiedAt: user.twoFactorVerifiedAt,
    backupCodesRemaining,
  });
}
