import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import {
  CLEARED_INVESTIGATION_FIELDS,
  isAccountStatus,
  isInvestigationStatus,
  hasWorkspaceAdminAccess,
  type InvestigationStatus,
} from "@/lib/workspace-admin";
import {
  MEMBER_SELECT,
  requireWorkspaceAdmin,
} from "@/lib/workspace-admin-server";

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

    const body = await request.json();
    const { status, note, investigationStatus } = body as {
      status?: string;
      note?: string;
      investigationStatus?: string;
    };

    if (!status || !isAccountStatus(status)) {
      return NextResponse.json(
        { error: "Invalid account status" },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isAdmin: true,
        staffRole: true,
        investigationStatus: true,
        investigationFlaggedAt: true,
        investigationFlaggedById: true,
        investigationFlaggedByUsername: true,
        investigationNote: true,
      },
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

    const actor = await prisma.user.findUnique({
      where: { id: auth.adminId },
      select: { id: true, username: true },
    });

    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trimmedNote =
      typeof note === "string" ? note.trim().slice(0, 500) : undefined;

    let investigationFields:
      | typeof CLEARED_INVESTIGATION_FIELDS
      | {
          investigationStatus: InvestigationStatus;
          investigationFlaggedAt: Date;
          investigationFlaggedById: number;
          investigationFlaggedByUsername: string;
          investigationNote: string | null;
        };

    if (status === "investigate") {
      const phase: InvestigationStatus =
        investigationStatus && isInvestigationStatus(investigationStatus)
          ? investigationStatus
          : ((target.investigationStatus as InvestigationStatus | null) ??
            "flagged");

      investigationFields = {
        investigationStatus: phase,
        investigationFlaggedAt: target.investigationFlaggedAt ?? new Date(),
        investigationFlaggedById: target.investigationFlaggedById ?? actor.id,
        investigationFlaggedByUsername:
          target.investigationFlaggedByUsername ?? actor.username,
        investigationNote:
          trimmedNote !== undefined
            ? trimmedNote || null
            : target.investigationNote,
      };
    } else {
      investigationFields = CLEARED_INVESTIGATION_FIELDS;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: status,
        ...investigationFields,
      },
      select: MEMBER_SELECT,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating member status:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
