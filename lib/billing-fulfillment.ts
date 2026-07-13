import type Stripe from "stripe";

import {
  API_PRODUCT,
  CREDIT_PACKS,
  getCreditPackTotal,
  normalizePlanId,
  planUpdatesFromId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { prisma } from "@/prisma/client";

type CheckoutMeta = {
  paymentId?: string;
  userId?: string;
  type?: string;
  planId?: string;
  interval?: string;
  packId?: string;
};

function parseMeta(session: Stripe.Checkout.Session): CheckoutMeta {
  return (session.metadata ?? {}) as CheckoutMeta;
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false as const, reason: "not_paid" };
  }

  const meta = parseMeta(session);
  const userId = Number(meta.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false as const, reason: "missing_user" };
  }

  const paymentId = meta.paymentId ? Number(meta.paymentId) : null;
  const existing =
    (paymentId
      ? await prisma.payment.findUnique({ where: { id: paymentId } })
      : null) ??
    (session.id
      ? await prisma.payment.findUnique({ where: { stripeSessionId: session.id } })
      : null);

  if (existing?.status === "completed") {
    return { ok: true as const, alreadyFulfilled: true };
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const type = meta.type ?? existing?.type;

  if (type === "subscription") {
    const planId = normalizePlanId(meta.planId ?? existing?.plan);
    const interval = (meta.interval ?? existing?.interval ?? "monthly") as BillingInterval;
    if (!planId || planId === "free" || planId === "enterprise") {
      return { ok: false as const, reason: "invalid_plan" };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...planUpdatesFromId(planId as PlanId),
          billingInterval: interval,
          ...(session.customer && typeof session.customer === "string"
            ? { stripeCustomerId: session.customer }
            : {}),
        },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                stripeSubscriptionId: subscriptionId,
                description: existing.description.replace(
                  "awaiting payment confirmation",
                  "paid via Stripe",
                ),
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount: (session.amount_total ?? 0) / 100,
                type: "subscription",
                plan: planId,
                interval,
                status: "completed",
                description: `${planId} (${interval}) — paid via Stripe`,
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                stripeSubscriptionId: subscriptionId,
              },
            }),
          ]),
    ]);

    return { ok: true as const, type: "subscription" as const, planId };
  }

  if (type === "credits") {
    const packId = meta.packId;
    const pack = CREDIT_PACKS.find((entry) => entry.id === packId);
    const creditTotal = pack
      ? getCreditPackTotal(pack)
      : existing
        ? Number(existing.description.match(/\$([\d.]+)/)?.[1] ?? existing.amount)
        : (session.amount_total ?? 0) / 100;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: creditTotal },
          ...(session.customer && typeof session.customer === "string"
            ? { stripeCustomerId: session.customer }
            : {}),
        },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                description: existing.description.replace(
                  "pending payment",
                  "paid via Stripe",
                ),
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount: (session.amount_total ?? 0) / 100,
                type: "balance_topup",
                status: "completed",
                description: `Credit top-up $${creditTotal.toFixed(2)} — paid via Stripe`,
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
              },
            }),
          ]),
    ]);

    return { ok: true as const, type: "credits" as const, credits: creditTotal };
  }

  if (type === "api_access") {
    const interval = (meta.interval ?? existing?.interval ?? "monthly") as BillingInterval;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { apiKey: true },
    });
    const apiKey =
      user?.apiKey || `anya_${crypto.randomUUID().replace(/-/g, "")}`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          apiAccess: true,
          apiKey,
          billingInterval: interval,
          ...(session.customer && typeof session.customer === "string"
            ? { stripeCustomerId: session.customer }
            : {}),
        },
      }),
      ...(existing
        ? [
            prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: "completed",
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                stripeSubscriptionId: subscriptionId,
                description: existing.description.replace(
                  "pending payment confirmation",
                  "paid via Stripe",
                ),
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                userId,
                amount: (session.amount_total ?? 0) / 100,
                type: "api_access",
                plan: API_PRODUCT.id,
                interval,
                status: "completed",
                description: `API Access (${interval}) — paid via Stripe`,
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                stripeSubscriptionId: subscriptionId,
              },
            }),
          ]),
    ]);

    return { ok: true as const, type: "api_access" as const };
  }

  return { ok: false as const, reason: "unknown_type" };
}
