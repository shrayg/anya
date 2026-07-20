import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getSessionCookie } from "@/app/lib/session";
import {
  consumeBackupCode,
  decryptTotpSecret,
  verifyTotpCode,
} from "@/lib/two-factor";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

/** Disable 2FA — requires current password + TOTP or backup code. */
export async function POST(request: Request) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!password || !code) {
    return NextResponse.json(
      { error: "Password and authenticator (or backup) code are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      password: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enabled" },
      { status: 400 },
    );
  }

  const passwordOk = await bcrypt.compare(password, user.password);

  if (!passwordOk) {
    return NextResponse.json(
      { error: "Password is incorrect" },
      { status: 400 },
    );
  }

  let codeOk = false;

  try {
    const secret = decryptTotpSecret(user.twoFactorSecret);

    codeOk = verifyTotpCode(secret, user.username, code);
  } catch {
    codeOk = false;
  }

  if (!codeOk) {
    const backup = await consumeBackupCode(user.twoFactorBackupCodes, code);

    if (!backup.ok) {
      return NextResponse.json(
        { error: "Invalid authenticator or backup code" },
        { status: 400 },
      );
    }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorVerifiedAt: null,
      twoFactorBackupCodes: null,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Two-factor authentication disabled",
  });
}
