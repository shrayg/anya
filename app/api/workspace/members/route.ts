import { NextResponse } from "next/server";

import {
  MEMBER_SELECT,
  requireWorkspaceAdmin,
  toAdminPasswordMeta,
} from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

export async function GET() {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const rows = await prisma.user.findMany({
      select: {
        ...MEMBER_SELECT,
        password: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const users = rows.map(({ password, ...user }) => ({
      ...user,
      ...toAdminPasswordMeta(password),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching workspace members:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
