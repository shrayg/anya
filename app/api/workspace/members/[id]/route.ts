import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

export async function DELETE(
  _request: Request,
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

    if (userId === auth.adminId) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, staffRole: true, username: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (hasWorkspaceAdminAccess(target)) {
      return NextResponse.json(
        { error: "Staff accounts cannot be deleted." },
        { status: 400 },
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      deleted: { id: target.id, username: target.username },
    });
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
