import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import { prisma } from "@/prisma/client";

/**
 * Recent completed payments for live admin toasts.
 * Poll with ?after=<ISO timestamp> (exclusive).
 */
export async function GET(req: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { isAdmin: true, staffRole: true },
  });

  if (!admin || !hasWorkspaceAdminAccess(admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const afterRaw = req.nextUrl.searchParams.get("after")?.trim();
  const after = afterRaw ? new Date(afterRaw) : null;
  const since =
    after && Number.isFinite(after.getTime())
      ? after
      : new Date(Date.now() - 60_000);

  const payments = await prisma.payment.findMany({
    where: {
      status: "completed",
      createdAt: { gt: since },
      amount: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: {
      id: true,
      amount: true,
      currency: true,
      type: true,
      plan: true,
      interval: true,
      description: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });

  return NextResponse.json({
    payments: payments.map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      type: row.type,
      plan: row.plan,
      interval: row.interval,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      username: row.user.username,
    })),
    serverTime: new Date().toISOString(),
  });
}
