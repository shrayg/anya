import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getSessionCookie } from "@/app/lib/session";
import { validatePassword } from "@/lib/password-policy";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();

  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return email;
}

export async function GET() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: {
      username: true,
      recoveryEmail: true,
      plan: true,
      billingInterval: true,
      balance: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as number;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "password") {
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);

    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return NextResponse.json({ ok: true, message: "Password updated" });
  }

  if (action === "recovery_email") {
    const raw =
      typeof body.recoveryEmail === "string" ? body.recoveryEmail : "";
    const recoveryEmail = normalizeEmail(raw);

    if (raw.trim() && !recoveryEmail) {
      return NextResponse.json(
        { error: "Enter a valid recovery email" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { recoveryEmail },
    });

    return NextResponse.json({
      ok: true,
      message: recoveryEmail
        ? "Recovery email saved"
        : "Recovery email removed",
      recoveryEmail,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
