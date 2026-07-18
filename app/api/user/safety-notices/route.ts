import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import { USER_NOTIFICATION_SELECT } from "@/lib/safety-flag-server";

/** Unread staff messages for the logged-in member (safety flag notices). */
export async function GET() {
  try {
    const session = await getSessionCookie();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId as number;

    const notices = await prisma.safetyFlag.findMany({
      where: {
        userId,
        helperMessage: { not: null },
        notifiedAt: { not: null },
        acknowledgedAt: null,
      },
      select: USER_NOTIFICATION_SELECT,
      orderBy: { notifiedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ notices });
  } catch (error) {
    console.error("Error loading safety notices:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Acknowledge (dismiss) a staff safety notice. */
export async function POST(request: Request) {
  try {
    const session = await getSessionCookie();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId as number;
    const body = await request.json();
    const flagId = parseInt(String(body?.flagId ?? ""), 10);

    if (Number.isNaN(flagId)) {
      return NextResponse.json({ error: "Invalid flag id" }, { status: 400 });
    }

    const flag = await prisma.safetyFlag.findFirst({
      where: { id: flagId, userId },
      select: { id: true },
    });

    if (!flag) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    await prisma.safetyFlag.update({
      where: { id: flagId },
      data: { acknowledgedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging safety notice:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
