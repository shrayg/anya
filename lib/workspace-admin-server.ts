import { NextResponse } from "next/server";
import "server-only";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import {
  hasHelperDashboardAccess,
  hasWorkspaceAdminAccess,
} from "@/lib/workspace-admin";

export const MEMBER_SELECT = {
  id: true,
  username: true,
  isAdmin: true,
  subscripted: true,
  plan: true,
  balance: true,
  staffRole: true,
  accountStatus: true,
  investigationStatus: true,
  investigationFlaggedAt: true,
  investigationFlaggedById: true,
  investigationFlaggedByUsername: true,
  investigationNote: true,
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

/** Safe fields for helpers — never include password, balance, plan, or payments. */
export const HELPER_MEMBER_SELECT = {
  id: true,
  username: true,
  staffRole: true,
  accountStatus: true,
  investigationStatus: true,
  investigationFlaggedAt: true,
  investigationFlaggedById: true,
  investigationFlaggedByUsername: true,
  investigationNote: true,
  createdAt: true,
  _count: {
    select: {
      cases: true,
      searches: true,
    },
  },
} as const;

export type AdminMemberPasswordMeta = {
  passwordSet: boolean;
  passwordStatus: "hashed";
  /** Truncated bcrypt hash prefix for admin visibility only — not reversible. */
  passwordHashPreview: string | null;
};

export function toAdminPasswordMeta(
  password: string | null | undefined,
): AdminMemberPasswordMeta {
  const set = Boolean(password && password.length > 0);

  return {
    passwordSet: set,
    passwordStatus: "hashed",
    passwordHashPreview: set ? `${password!.slice(0, 12)}…` : null,
  };
}

export async function requireWorkspaceAdmin() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, isAdmin: true, staffRole: true, username: true },
  });

  if (!admin || !hasWorkspaceAdminAccess(admin)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { adminId: admin.id, username: admin.username };
}

export async function requireWorkspaceHelper() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const helper = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, isAdmin: true, staffRole: true, username: true },
  });

  if (!helper || !hasHelperDashboardAccess(helper)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { helperId: helper.id, username: helper.username };
}

/** Helper or admin — for shared safety-flag review queues. */
export async function requireWorkspaceStaff() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const staff = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, isAdmin: true, staffRole: true, username: true },
  });

  if (!staff) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const isAdmin = hasWorkspaceAdminAccess(staff);
  const isHelper = hasHelperDashboardAccess(staff);

  if (!isAdmin && !isHelper) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    staffId: staff.id,
    username: staff.username,
    isAdmin,
    isHelper,
  };
}
