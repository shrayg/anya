import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { syncUserPlanLifecycle } from "@/lib/plan-lifecycle";
import { resolveUserPlan } from "@/lib/plans";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

/**
 * Client-side payment confirmation poll (crypto return URL lands on ?billing=pending).
 * Returns whether the signed-in user already has a completed checkout / paid plan.
 */
export async function GET() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ authenticated: false, confirmed: false });
  }

  const userId = session.userId as number;

  await syncUserPlanLifecycle(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscripted: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      freeTier: true,
      professionalTier: true,
      investigatorTier: true,
      enterpriseTier: true,
      billingInterval: true,
    },
  });

  if (!user) {
    return NextResponse.json({ authenticated: false, confirmed: false });
  }

  const latestCompleted = await prisma.payment.findFirst({
    where: {
      userId,
      status: "completed",
      type: { in: ["subscription", "balance_topup", "api_access"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      plan: true,
      amount: true,
      description: true,
      createdAt: true,
    },
  });

  const latestPending = await prisma.payment.findFirst({
    where: {
      userId,
      status: "pending",
      type: { in: ["subscription", "balance_topup", "api_access"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, plan: true, createdAt: true },
  });

  const plan = resolveUserPlan(user);
  const hasPaidPlan = plan !== "free" && Boolean(user.subscripted);
  const completedBeatsPending =
    Boolean(latestCompleted) &&
    (!latestPending ||
      latestCompleted!.createdAt.getTime() >=
        latestPending.createdAt.getTime());
  const confirmed = hasPaidPlan || completedBeatsPending;

  return NextResponse.json({
    authenticated: true,
    confirmed,
    plan,
    planEndsAt: user.planEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    billingInterval: user.billingInterval,
    latestCompleted: latestCompleted
      ? {
          id: latestCompleted.id,
          type: latestCompleted.type,
          plan: latestCompleted.plan,
          amount: latestCompleted.amount,
          description: latestCompleted.description,
          createdAt: latestCompleted.createdAt.toISOString(),
        }
      : null,
    latestPending: latestPending
      ? {
          id: latestPending.id,
          type: latestPending.type,
          plan: latestPending.plan,
          createdAt: latestPending.createdAt.toISOString(),
        }
      : null,
  });
}
