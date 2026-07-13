import {
  API_PRODUCT,
  CREDIT_PACKS,
  getCreditPackTotal,
  normalizePlanId,
  planUpdatesFromId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { notifyPaymentDiscord } from "@/lib/discord-payments-webhook";
import type { BillingMeta } from "@/lib/square";
import { prisma } from "@/prisma/client";

export type FulfillBillingInput = {
  meta: BillingMeta;
  /** Square payment link id or order id — stored in checkout session column */
  checkoutSessionId: string;
  paymentReferenceId?: string | null;
  amountCents?: number | null;
};

async function sendPaymentNotification(input: {
  userId: number;
  amount: number;
  type: string;
  plan?: string | null;
  interval?: string | null;
  description?: string;
  paymentId?: number | null;
  providerRef?: string | null;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { username: true },
    });

    await notifyPaymentDiscord({
      username: user?.username ?? `user#${input.userId}`,
      amount: input.amount,
      type: input.type,
      plan: input.plan,
      interval: input.interval,
      description: input.description,
      paymentId: input.paymentId,
      providerRef: input.providerRef,
    });
  } catch (error) {
    console.error("[billing] payment discord notify failed", error);
  }
}

export async function fulfillBillingPayment(input: FulfillBillingInput) {
  const { meta, checkoutSessionId, paymentReferenceId, amountCents } = input;
  const userId = Number(meta.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false as const, reason: "missing_user" };
  }

  const paymentId = meta.paymentId ? Number(meta.paymentId) : null;
  const existing =
    (paymentId
      ? await prisma.payment.findUnique({ where: { id: paymentId } })
      : null) ??
    (checkoutSessionId
      ? await prisma.payment.findUnique({
          where: { stripeSessionId: checkoutSessionId },
        })
      : null);

  if (existing?.status === "completed") {
    return { ok: true as const, alreadyFulfilled: true };
  }

  const amount =
    amountCents != null
      ? amountCents / 100
      : existing?.amount ?? 0;

  if (meta.type === "subscription") {
    const planId = normalizePlanId(meta.planId ?? existing?.plan);
    const interval = (meta.interval ?? existing?.interval ?? "monthly") as BillingInterval;
    if (!planId || planId === "free" || planId === "enterprise") {
      return { ok: false as const, reason: "invalid_plan" };
    }

    const description = existing
      ? existing.description
          .replace("awaiting payment confirmation", "paid via Square")
          .replace("paid via Stripe", "paid via Square")
      : `${planId} (${interval}) — paid via Square`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...planUpdatesFromId(planId as PlanId),
          billingInterval: interval,
        },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
                description,
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount,
                type: "subscription",
                plan: planId,
                interval,
                status: "completed",
                description,
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
              },
            }),
          ]),
    ]);

    await sendPaymentNotification({
      userId,
      amount,
      type: "subscription",
      plan: planId,
      interval,
      description,
      paymentId: existing?.id ?? paymentId,
      providerRef: paymentReferenceId ?? checkoutSessionId,
    });

    return { ok: true as const, type: "subscription" as const, planId };
  }

  if (meta.type === "credits") {
    const pack = CREDIT_PACKS.find((entry) => entry.id === meta.packId);
    const creditTotal = pack
      ? getCreditPackTotal(pack)
      : existing
        ? Number(existing.description.match(/\$([\d.]+)/)?.[1] ?? existing.amount)
        : amount;

    const description = existing
      ? existing.description
          .replace("pending payment", "paid via Square")
          .replace("paid via Stripe", "paid via Square")
      : `Credit top-up $${creditTotal.toFixed(2)} — paid via Square`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: creditTotal } },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
                description,
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount,
                type: "balance_topup",
                status: "completed",
                description,
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
              },
            }),
          ]),
    ]);

    await sendPaymentNotification({
      userId,
      amount,
      type: "credits",
      description,
      paymentId: existing?.id ?? paymentId,
      providerRef: paymentReferenceId ?? checkoutSessionId,
    });

    return { ok: true as const, type: "credits" as const, credits: creditTotal };
  }

  if (meta.type === "api_access") {
    const interval = (meta.interval ?? existing?.interval ?? "monthly") as BillingInterval;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { apiKey: true },
    });
    const apiKey =
      user?.apiKey || `anya_${crypto.randomUUID().replace(/-/g, "")}`;

    const description = existing
      ? existing.description
          .replace("awaiting payment confirmation", "paid via Square")
          .replace("pending payment confirmation", "paid via Square")
          .replace("paid via Stripe", "paid via Square")
      : `API Access (${interval}) — paid via Square`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          apiAccess: true,
          apiKey,
          billingInterval: interval,
        },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
                description,
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount,
                type: "api_access",
                plan: API_PRODUCT.id,
                interval,
                status: "completed",
                description,
                stripeSessionId: checkoutSessionId,
                stripePaymentIntentId: paymentReferenceId ?? undefined,
              },
            }),
          ]),
    ]);

    await sendPaymentNotification({
      userId,
      amount,
      type: "api_access",
      plan: API_PRODUCT.id,
      interval,
      description,
      paymentId: existing?.id ?? paymentId,
      providerRef: paymentReferenceId ?? checkoutSessionId,
    });

    return { ok: true as const, type: "api_access" as const };
  }

  return { ok: false as const, reason: "unknown_type" };
}
