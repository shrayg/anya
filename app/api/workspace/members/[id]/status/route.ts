import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { isAccountStatus, hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import { MEMBER_SELECT, requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

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

    const { status } = await request.json();

    if (!status || !isAccountStatus(status)) {
      return NextResponse.json({ error: "Invalid account status" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, staffRole: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (hasWorkspaceAdminAccess(target) && status !== "active") {
      return NextResponse.json(
        { error: "Staff accounts cannot be frozen, banned, or flagged." },
        { status: 400 },
      );
    }

    if (target.id === auth.adminId && status !== "active") {
      return NextResponse.json(
        { error: "You cannot restrict your own account." },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: status },
      select: MEMBER_SELECT,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating member status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
