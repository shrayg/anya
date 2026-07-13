import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { attachSessionCookie } from "@/app/lib/session";
import {
  clearAuthFailures,
  getAuthLockoutStatus,
  getClientIp,
  lockoutResponse,
} from "@/lib/auth-lockout";
import { isPasswordBreached } from "@/lib/hibp";
import {
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "@/lib/password-policy";
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

    const normalizedUsername = normalizeUsername(username);
    const ip = getClientIp(request);
    const lockout = getAuthLockoutStatus(ip, normalizedUsername);

    if (lockout.locked) {
      return NextResponse.json(lockoutResponse(lockout.retryAfterSeconds), {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { username: username.trim() },
        ],
      },
      select: { id: true },
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
        accountStatus: "active",
      },
    });

    clearAuthFailures(ip, normalizedUsername);

    const response = NextResponse.json(
      {
        success: true,
        user: { username: user.username, isAdmin: user.isAdmin },
      },
      { status: 201 },
    );

    return attachSessionCookie(response, user.id, user.isAdmin);
  } catch (error) {
    console.error("Register error:", error);

    // Unique constraint race
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
