import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { setSessionCookie } from "@/app/lib/session";
import {
  clearAuthFailures,
  getAuthLockoutStatus,
  getClientIp,
  lockoutResponse,
} from "@/lib/auth-lockout";
import { isPasswordBreached } from "@/lib/hibp";
import { validatePassword, validateUsername } from "@/lib/password-policy";
import { prisma } from "@/prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const normalizedUsername = username.trim();
    const ip = getClientIp(request);
    const lockout = getAuthLockoutStatus(ip, normalizedUsername);

    if (lockout.locked) {
      return NextResponse.json(lockoutResponse(lockout.retryAfterSeconds), {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    if (await isPasswordBreached(password)) {
      return NextResponse.json(
        {
          error:
            "This password appears in known data breaches. Choose a different password.",
        },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        password: hashedPassword,
        plan: "free",
        freeTier: true,
      },
    });

    clearAuthFailures(ip, normalizedUsername);
    await setSessionCookie(user.id, user.isAdmin);

    return NextResponse.json(
      { success: true, user: { username: user.username, isAdmin: user.isAdmin } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
