import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { setSessionCookie } from "@/app/lib/session";
import {
  clearAuthFailures,
  getAuthLockoutStatus,
  getClientIp,
  lockoutResponse,
  recordAuthFailure,
} from "@/lib/auth-lockout";
import { prisma } from "@/prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const lockout = getAuthLockoutStatus(ip, username);

    if (lockout.locked) {
      return NextResponse.json(lockoutResponse(lockout.retryAfterSeconds), {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!user || !passwordMatch) {
      const failure = recordAuthFailure(ip, username);

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

    if (user.accountStatus === "frozen") {
      return NextResponse.json(
        { error: "This account is frozen. Contact support to restore access." },
        { status: 403 },
      );
    }

    clearAuthFailures(ip, username);
    await setSessionCookie(user.id, user.isAdmin);

    return NextResponse.json({
      success: true,
      user: { username: user.username, isAdmin: user.isAdmin },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
