import { NextResponse } from "next/server";

import {
  getDisplayPrice,
  getPlanDefinition,
  normalizePlanId,
  planUpdatesFromId,
} from "@/lib/plans";
import { recordPayment } from "@/lib/payments";
import { MEMBER_SELECT, requireWorkspaceAdmin } from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const userId = parseInt(id, 10);
    const { plan } = await request.json();
    const planId = normalizePlanId(plan);

    if (!planId) {
      return NextResponse.json({ error: "Invalid plan specified" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: planUpdatesFromId(planId),
      select: MEMBER_SELECT,
    });

    const planDefinition = getPlanDefinition(planId);
    const price = getDisplayPrice(planDefinition);

    if (price.value && price.value > 0) {
      await recordPayment({
        userId,
        amount: price.value,
        type: "subscription",
        plan: planId,
        description: `${planDefinition.name} plan assigned by staff`,
      });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating member plan:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
