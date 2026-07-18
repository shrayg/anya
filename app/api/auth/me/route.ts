import { NextResponse } from "next/server";
import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import {
  getAccountStatusMessage,
  hasHelperDashboardAccess,
  hasWorkspaceAdminAccess,
} from "@/lib/workspace-admin";

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
        billingInterval: true,
        apiAccess: true,
        apiKey: true,
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
      const canAccessHelperDashboard = hasHelperDashboardAccess(user);

      return NextResponse.json({
        authenticated: true,
        frozen: true,
        canManageWorkspace,
        canAccessHelperDashboard,
        message: getAccountStatusMessage(user.accountStatus),
        user: { ...user, canManageWorkspace, canAccessHelperDashboard },
      });
    }

    const canManageWorkspace = hasWorkspaceAdminAccess(user);
    const canAccessHelperDashboard = hasHelperDashboardAccess(user);

    return NextResponse.json({
      authenticated: true,
      canManageWorkspace,
      canAccessHelperDashboard,
      user: { ...user, canManageWorkspace, canAccessHelperDashboard },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
