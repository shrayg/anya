import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import { createManualSafetyFlag } from "@/lib/safety-flag-server";
import {
  HELPER_MEMBER_SELECT,
  requireWorkspaceHelper,
} from "@/lib/workspace-admin-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceHelper();
    if (auth.error) return auth.error;

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    let note = "";

    try {
      const body = await request.json();
      if (typeof body?.note === "string") {
        note = body.note.trim().slice(0, 500);
      }
    } catch {
      // optional JSON body
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isAdmin: true,
        staffRole: true,
        accountStatus: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (hasWorkspaceAdminAccess(target)) {
      return NextResponse.json(
        { error: "Staff accounts cannot be flagged for investigation." },
        { status: 400 },
      );
    }

    if (target.id === auth.helperId) {
      return NextResponse.json(
        { error: "You cannot flag your own account." },
        { status: 400 },
      );
    }

    const alreadyFlagged = target.accountStatus === "investigate";

    const flag = await createManualSafetyFlag({
      userId,
      source: "helper",
      actorId: auth.helperId,
      actorUsername: auth.username,
      note: note || undefined,
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: HELPER_MEMBER_SELECT,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      flag,
      alreadyFlagged,
    });
  } catch (error) {
    console.error("Error flagging member for investigation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
