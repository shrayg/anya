import { NextResponse } from "next/server";
import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import { getAccountStatusMessage, hasWorkspaceAdminAccess } from "@/lib/workspace-admin";

export async function GET() {
  try {
    const session = await getSessionCookie();
    
    if (!session || !session.userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId as number },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        staffRole: true,
        accountStatus: true,
        plan: true,
        balance: true,
        freeTier: true,
        professionalTier: true,
        investigatorTier: true,
        enterpriseTier: true,
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json(
        {
          authenticated: false,
          blocked: true,
          status: user.accountStatus,
          message: getAccountStatusMessage(user.accountStatus),
        },
        { status: 403 },
      );
    }

    if (user.accountStatus === "frozen") {
      const canManageWorkspace = hasWorkspaceAdminAccess(user);

      return NextResponse.json({
        authenticated: true,
        frozen: true,
        canManageWorkspace,
        message: getAccountStatusMessage(user.accountStatus),
        user: { ...user, canManageWorkspace },
      });
    }

    const canManageWorkspace = hasWorkspaceAdminAccess(user);

    return NextResponse.json({
      authenticated: true,
      canManageWorkspace,
      user: { ...user, canManageWorkspace },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
