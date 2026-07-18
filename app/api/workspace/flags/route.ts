import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { SAFETY_FLAG_SELECT } from "@/lib/safety-flag-server";
import { isSafetyFlagStatus } from "@/lib/safety-search-flags";
import { requireWorkspaceStaff } from "@/lib/workspace-admin-server";

export async function GET(request: Request) {
  try {
    const auth = await requireWorkspaceStaff();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && isSafetyFlagStatus(statusParam) ? statusParam : null;

    // Helpers focus on open/reviewing; admins can filter or see all.
    const where = auth.isAdmin
      ? status
        ? { status }
        : {}
      : {
          status: status
            ? status === "resolved"
              ? "resolved"
              : status
            : { in: ["open", "reviewing"] },
        };

    const [flags, openCount, reviewingCount] = await Promise.all([
      prisma.safetyFlag.findMany({
        where,
        select: SAFETY_FLAG_SELECT,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.safetyFlag.count({ where: { status: "open" } }),
      prisma.safetyFlag.count({ where: { status: "reviewing" } }),
    ]);

    return NextResponse.json({
      flags,
      summary: {
        open: openCount,
        reviewing: reviewingCount,
        needsReview: openCount + reviewingCount,
      },
    });
  } catch (error) {
    console.error("Error listing safety flags:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
