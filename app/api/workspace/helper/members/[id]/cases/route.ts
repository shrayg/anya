import { NextResponse } from "next/server";

import { requireWorkspaceHelper } from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Read-only case list for a target user — helpers only; no payments/passwords. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireWorkspaceHelper();

    if (auth.error) return auth.error;

    const { id } = await context.params;
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cases = await prisma.case.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        subjectName: true,
        username: true,
        email: true,
        phone: true,
        location: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { searches: true } },
      },
    });

    return NextResponse.json({
      user: target,
      cases,
    });
  } catch (error) {
    console.error("Helper list user cases error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
