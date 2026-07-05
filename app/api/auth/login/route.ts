import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/app/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json(
        { error: "This account has been banned." },
        { status: 403 }
      );
    }

    if (user.accountStatus === "frozen") {
      return NextResponse.json(
        { error: "This account is frozen. Contact support to restore access." },
        { status: 403 }
      );
    }

    await setSessionCookie(user.id, user.isAdmin);

    return NextResponse.json({ success: true, user: { username: user.username, isAdmin: user.isAdmin } });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
