import { NextRequest, NextResponse } from "next/server";

import {
  MEMBER_SELECT,
  requireWorkspaceAdmin,
} from "@/lib/workspace-admin-server";
import { parseStaffRole } from "@/lib/staff-roles";
import { prisma } from "@/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const { id } = await params;
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const body = (await req.json()) as { staffRole?: string | null };
    const staffRole =
      body.staffRole === null || body.staffRole === ""
        ? null
        : parseStaffRole(body.staffRole);

    if (body.staffRole && !staffRole) {
      return NextResponse.json(
        { error: "Invalid staff role" },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        staffRole,
        isAdmin: staffRole === "admin",
      },
      select: MEMBER_SELECT,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error updating staff role:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
