import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import {
  SAFETY_FLAG_SELECT,
  sendFlagHelperMessage,
} from "@/lib/safety-flag-server";
import { isSafetyFlagStatus } from "@/lib/safety-search-flags";
import { requireWorkspaceStaff } from "@/lib/workspace-admin-server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceStaff();
    if (auth.error) return auth.error;

    const { id } = await params;
    const flagId = parseInt(id, 10);

    if (Number.isNaN(flagId)) {
      return NextResponse.json({ error: "Invalid flag id" }, { status: 400 });
    }

    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "status";
    const helperMessage =
      typeof body?.helperMessage === "string"
        ? body.helperMessage.trim().slice(0, 1000)
        : undefined;
    const status = typeof body?.status === "string" ? body.status : "";
    const reviewNote =
      typeof body?.reviewNote === "string"
        ? body.reviewNote.trim().slice(0, 500)
        : undefined;
    const escalateAccount = Boolean(body?.escalateAccount);

    const existing = await prisma.safetyFlag.findUnique({
      where: { id: flagId },
      select: { id: true, userId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }

    if (!auth.isAdmin && existing.status === "resolved") {
      return NextResponse.json(
        { error: "Resolved flags are locked for helpers." },
        { status: 403 },
      );
    }

    // Send message to flagged user (marks notified; user must acknowledge in dashboard).
    if (action === "message" || helperMessage) {
      if (!helperMessage) {
        return NextResponse.json(
          { error: "helperMessage is required." },
          { status: 400 },
        );
      }

      const flag = await sendFlagHelperMessage({
        flagId,
        actorId: auth.staffId,
        actorUsername: auth.username,
        message: helperMessage,
        assignHelper: auth.isHelper,
      });

      return NextResponse.json({ success: true, flag });
    }

    if (!isSafetyFlagStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (!auth.isAdmin && status === "open") {
      return NextResponse.json(
        { error: "Helpers cannot reopen resolved flags." },
        { status: 403 },
      );
    }

    const flag = await prisma.safetyFlag.update({
      where: { id: flagId },
      data: {
        status,
        reviewedById: auth.staffId,
        reviewedByUsername: auth.username,
        reviewNote:
          reviewNote !== undefined ? reviewNote || null : undefined,
        assignedHelperId: auth.isHelper ? auth.staffId : undefined,
        assignedHelperUsername: auth.isHelper ? auth.username : undefined,
        resolvedAt: status === "resolved" ? new Date() : null,
      },
      select: SAFETY_FLAG_SELECT,
    });

    if (escalateAccount && auth.isAdmin) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          accountStatus: "investigate",
          investigationStatus: "under_investigation",
          investigationFlaggedAt: new Date(),
          investigationFlaggedById: auth.staffId,
          investigationFlaggedByUsername: auth.username,
          investigationNote: (
            reviewNote || `Escalated from safety flag #${flagId}`
          ).slice(0, 500),
        },
      });
    }

    return NextResponse.json({ success: true, flag });
  } catch (error) {
    console.error("Error updating safety flag:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
