import {
  planUpdatesFromId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { prisma } from "@/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export function billingIntervalDurationMs(
  interval: string | null | undefined,
): number {
  return interval === "annual" ? 365 * DAY_MS : 30 * DAY_MS;
}

export function computePlanEndsAt(
  from: Date,
  interval: string | null | undefined,
): Date {
  return new Date(from.getTime() + billingIntervalDurationMs(interval));
}

export function detectBillingChannel(
  description: string | null | undefined,
): "crypto" | "card" | "unknown" {
  const text = (description ?? "").toLowerCase();

  if (text.includes("oxapay") || text.includes("crypto")) return "crypto";
  if (text.includes("square") || text.includes("card")) return "card";

  return "unknown";
}

/**
 * Ensure planEndsAt exists for paid users (backfill from last subscription payment).
 * Downgrade to free when the paid period has ended.
 */
export async function syncUserPlanLifecycle(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      billingInterval: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      freeTier: true,
      professionalTier: true,
      investigatorTier: true,
      enterpriseTier: true,
    },
  });

  if (!user) return null;

  const isPaid =
    user.plan !== "free" ||
    user.professionalTier ||
    user.investigatorTier ||
    user.enterpriseTier;

  if (!isPaid) {
    return user;
  }

  let planEndsAt = user.planEndsAt;

  if (!planEndsAt) {
    const lastSubscription = await prisma.payment.findFirst({
      where: {
        userId,
        type: "subscription",
        status: "completed",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, interval: true },
    });

    if (lastSubscription) {
      planEndsAt = computePlanEndsAt(
        lastSubscription.createdAt,
        lastSubscription.interval ?? user.billingInterval,
      );
      await prisma.user.update({
        where: { id: userId },
        data: { planEndsAt },
      });
    }
  }

  if (planEndsAt && planEndsAt.getTime() <= Date.now()) {
    const downgraded = await prisma.user.update({
      where: { id: userId },
      data: {
        ...planUpdatesFromId("free" as PlanId),
        cancelAtPeriodEnd: false,
        planEndsAt: null,
      },
    });

    return downgraded;
  }

  return planEndsAt !== user.planEndsAt ? { ...user, planEndsAt } : user;
}

export async function schedulePlanCancel(userId: number) {
  const user = await syncUserPlanLifecycle(userId);

  if (!user || user.plan === "free") {
    return { ok: false as const, error: "No active paid plan to cancel" };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { cancelAtPeriodEnd: true },
    select: {
      plan: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      billingInterval: true,
    },
  });

  return {
    ok: true as const,
    message: updated.planEndsAt
      ? `Cancellation scheduled. You keep ${updated.plan} access until ${updated.planEndsAt.toISOString()}.`
      : "Cancellation scheduled. Access continues until the end of your current period.",
    user: updated,
  };
}

export async function resumePlan(userId: number) {
  const user = await syncUserPlanLifecycle(userId);

  if (!user || user.plan === "free") {
    return { ok: false as const, error: "No active paid plan" };
  }
  if (!user.cancelAtPeriodEnd) {
    return { ok: false as const, error: "Plan is not scheduled to cancel" };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { cancelAtPeriodEnd: false },
    select: {
      plan: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      billingInterval: true,
    },
  });

  return {
    ok: true as const,
    message:
      "Cancellation withdrawn. Renew before the period ends to keep access — crypto does not auto-renew.",
    user: updated,
  };
}

export type { BillingInterval };
