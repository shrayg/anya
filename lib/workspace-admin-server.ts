import { NextResponse } from "next/server";
import "server-only";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";

export const MEMBER_SELECT = {
  id: true,
  username: true,
  isAdmin: true,
  subscripted: true,
  plan: true,
  balance: true,
  staffRole: true,
  accountStatus: true,
  freeTier: true,
  professionalTier: true,
  investigatorTier: true,
  enterpriseTier: true,
  createdAt: true,
  _count: {
    select: {
      searches: true,
      payments: true,
    },
  },
} as const;

export async function requireWorkspaceAdmin() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, isAdmin: true, staffRole: true },
  });

  if (!admin || !hasWorkspaceAdminAccess(admin)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { adminId: admin.id };
}
