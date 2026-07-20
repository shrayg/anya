import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { attachSessionCookie } from "@/app/lib/session";
import {
  clearAuthFailures,
  getAuthLockoutStatus,
  getClientIp,
  lockoutResponse,
  recordAuthFailure,
} from "@/lib/auth-lockout";
import { normalizeUsername } from "@/lib/password-policy";
import { createLoginPendingToken } from "@/lib/two-factor";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { prisma } from "@/prisma/client";

async function findUserForLogin(rawUsername: string) {
  const trimmed = rawUsername.trim();
  const normalized = normalizeUsername(trimmed);

  const byNormalized = await prisma.user.findUnique({
    where: { username: normalized },
  });

  if (byNormalized) return byNormalized;

  // Legacy accounts may have been stored with original casing.
  if (trimmed !== normalized) {
    return prisma.user.findUnique({ where: { username: trimmed } });
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const turnstileToken =
      typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

    if (!username.trim() || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    const lockoutUsername = normalizeUsername(username);
    const ip = getClientIp(request);

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);

    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: 400 });
    }
    const lockout = getAuthLockoutStatus(ip, lockoutUsername);

    if (lockout.locked) {
      return NextResponse.json(lockoutResponse(lockout.retryAfterSeconds), {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      });
    }

    const user = await findUserForLogin(username);

    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!user || !passwordMatch) {
      const failure = recordAuthFailure(ip, lockoutUsername);

      if (failure.locked) {
        return NextResponse.json(lockoutResponse(failure.retryAfterSeconds), {
          status: 429,
          headers: { "Retry-After": String(failure.retryAfterSeconds) },
        });
      }

      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json(
        { error: "This account has been banned." },
        { status: 403 },
      );
    }

    // Frozen users may still sign in so they can see status / contact support.
    clearAuthFailures(ip, lockoutUsername);

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const pendingToken = await createLoginPendingToken(
        user.id,
        user.isAdmin,
      );

      return NextResponse.json({
        success: true,
        requires2fa: true,
        pendingToken,
        user: {
          username: user.username,
        },
      });
    }

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
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
