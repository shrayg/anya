import { NextResponse } from "next/server";

import { attachSessionCookie } from "@/app/lib/session";
import {
  clearAuthFailures,
  getAuthLockoutStatus,
  getClientIp,
  lockoutResponse,
  recordAuthFailure,
} from "@/lib/auth-lockout";
import {
  consumeBackupCode,
  decryptTotpSecret,
  verifyLoginPendingToken,
  verifyTotpCode,
} from "@/lib/two-factor";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

/** Complete login after password step when 2FA is enabled. */
export async function POST(request: Request) {
  try {
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

    const pending = await verifyLoginPendingToken(pendingToken);

    if (!pending) {
      return NextResponse.json(
        { error: "Login session expired. Sign in again." },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const lockoutKey = `2fa:${pending.userId}`;
    const lockout = getAuthLockoutStatus(ip, lockoutKey);

    if (lockout.locked) {
      return NextResponse.json(lockoutResponse(lockout.retryAfterSeconds), {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        accountStatus: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "Two-factor authentication is not available" },
        { status: 400 },
      );
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json(
        { error: "This account has been banned." },
        { status: 403 },
      );
    }

    let codeOk = false;
    let remainingBackup: string | null | undefined;

    try {
      const secret = decryptTotpSecret(user.twoFactorSecret);

      codeOk = verifyTotpCode(secret, user.username, code);
    } catch {
      codeOk = false;
    }

    if (!codeOk) {
      const backup = await consumeBackupCode(user.twoFactorBackupCodes, code);

      if (backup.ok) {
        codeOk = true;
        remainingBackup = backup.remainingJson;
      }
    }

    if (!codeOk) {
      const failure = recordAuthFailure(ip, lockoutKey);

      if (failure.locked) {
        return NextResponse.json(lockoutResponse(failure.retryAfterSeconds), {
          status: 429,
          headers: { "Retry-After": String(failure.retryAfterSeconds) },
        });
      }

      return NextResponse.json(
        { error: "Invalid authenticator or backup code" },
        { status: 401 },
      );
    }

    if (remainingBackup !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: remainingBackup },
      });
    }

    clearAuthFailures(ip, lockoutKey);

    const response = NextResponse.json({
      success: true,
      frozen: user.accountStatus === "frozen",
      user: {
        username: user.username,
        isAdmin: user.isAdmin,
        accountStatus: user.accountStatus,
      },
    });

    return attachSessionCookie(response, user.id, user.isAdmin);
  } catch (error) {
    console.error("2FA login error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
