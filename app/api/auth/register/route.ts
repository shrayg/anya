import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/app/lib/session";
import { validatePassword, validateUsername } from "@/lib/password-policy";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const usernameError = validateUsername(username ?? "");
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validatePassword(password ?? "");
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const normalizedUsername = String(username).trim();

    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        password: hashedPassword,
        plan: "free",
        freeTier: true,
      },
    });

    await setSessionCookie(user.id, user.isAdmin);

    return NextResponse.json({ success: true, user: { username: user.username, isAdmin: user.isAdmin } }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
