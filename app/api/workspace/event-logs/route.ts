import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const userIdRaw = req.nextUrl.searchParams.get("userId")?.trim();
    const username = req.nextUrl.searchParams.get("username")?.trim();
    const action = req.nextUrl.searchParams.get("action")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || "80");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 80),
    );

    const where: {
      userId?: number;
      action?: { contains: string };
      status?: string;
      user?: { username: { contains: string; mode?: "insensitive" } };
    } = {};

    if (userIdRaw && /^\d+$/.test(userIdRaw)) {
      where.userId = Number(userIdRaw);
    }

    if (username) {
      // SQLite: case-insensitive via contains without mode.
      where.user = { username: { contains: username } };
    }

    if (action) {
      where.action = { contains: action };
    }

    if (
      status &&
      ["ok", "error", "partial", "rate_limited", "info"].includes(status)
    ) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.osintEventLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, username: true } },
        },
      }),
      prisma.osintEventLog.count({ where }),
    ]);

    const actions = await prisma.osintEventLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 200,
    });

    return NextResponse.json({
      total,
      limit,
      actions: actions.map((row) => row.action),
      logs: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        username: row.user.username,
        action: row.action,
        status: row.status,
        message: row.message,
        queryPreview: row.queryPreview,
        moduleSlug: row.moduleSlug,
        metaJson: row.metaJson,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("event-logs GET failed:", error);

    return NextResponse.json(
      { error: "Could not load event logs." },
      { status: 500 },
    );
  }
}
