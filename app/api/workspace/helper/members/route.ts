import { NextResponse } from "next/server";

import {
  HELPER_MEMBER_SELECT,
  requireWorkspaceHelper,
} from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

export async function GET() {
  try {
    const auth = await requireWorkspaceHelper();

    if (auth.error) return auth.error;

    const users = await prisma.user.findMany({
      select: HELPER_MEMBER_SELECT,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching helper members:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
