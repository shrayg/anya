import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/prisma/client";
import { validatePassword } from "@/lib/password-policy";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const { password } = (await request.json()) as { password?: string };

    const passwordError = validatePassword(password ?? "");
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isAdmin: true, staffRole: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      hasWorkspaceAdminAccess(target) &&
      target.id !== auth.adminId
    ) {
      return NextResponse.json(
        { error: "You cannot reset another admin's password." },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password!, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      username: target.username,
      password,
      message: `Password reset for ${target.username}.`,
    });
  } catch (error) {
    console.error("Error resetting member password:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
