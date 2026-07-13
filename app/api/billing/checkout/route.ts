import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import {
  API_PRODUCT,
  CREDIT_PACKS,
  getApiPrice,
  getCreditPackTotal,
  getPlanDefinition,
  getPlanPrice,
  normalizePlanId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { recordPayment } from "@/lib/payments";
import {
  dollarsToCents,
  getAppBaseUrl,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function isInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

async function ensureStripeCustomer(userId: number, username: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: username,
    metadata: { userId: String(userId) },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server" },
      { status: 503 },
    );
  }

  const userId = session.userId as number;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, stripeCustomerId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const type = (body as { type?: string }).type;
  const stripe = getStripe();
  const baseUrl = getAppBaseUrl(request.url);
  const customerId = await ensureStripeCustomer(dbUser.id, dbUser.username);

  if (type === "subscription") {
    const planId = normalizePlanId((body as { planId?: string }).planId);
    const interval = (body as { interval?: string }).interval;
    if (!planId || planId === "free" || planId === "enterprise") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (!isInterval(interval)) {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const plan = getPlanDefinition(planId as PlanId);
    const price = getPlanPrice(plan, interval);
    if (price.value == null) {
      return NextResponse.json({ error: "Plan requires sales contact" }, { status: 400 });
    }

    const payment = await recordPayment({
      userId,
      amount: price.value,
      type: "subscription",
      plan: planId,
      interval,
      status: "pending",
      description: `${plan.name} (${interval}) — awaiting payment confirmation`,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(userId),
      success_url: `${baseUrl}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?billing=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: dollarsToCents(price.value),
            recurring: {
              interval: interval === "annual" ? "year" : "month",
            },
            product_data: {
              name: `Anya.Int ${plan.name}`,
              description:
                interval === "annual"
                  ? `${plan.name} plan billed annually`
                  : `${plan.name} plan billed monthly`,
            },
          },
        },
      ],
      metadata: {
        paymentId: String(payment?.id ?? ""),
        userId: String(userId),
        type: "subscription",
        planId,
        interval,
      },
      subscription_data: {
        metadata: {
          userId: String(userId),
          planId,
          interval,
        },
      },
    });

    if (payment?.id && checkoutSession.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  }

  if (type === "credits") {
    const packId = (body as { packId?: string }).packId;
    const pack = CREDIT_PACKS.find((entry) => entry.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const creditTotal = getCreditPackTotal(pack);

    const payment = await recordPayment({
      userId,
      amount: pack.price,
      type: "balance_topup",
      status: "pending",
      description: `${pack.name}: $${creditTotal.toFixed(2)} credit (pending payment)`,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: String(userId),
      success_url: `${baseUrl}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?billing=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: dollarsToCents(pack.price),
            product_data: {
              name: `Anya.Int ${pack.name}`,
              description: `$${creditTotal.toFixed(2)} investigation credit`,
            },
          },
        },
      ],
      metadata: {
        paymentId: String(payment?.id ?? ""),
        userId: String(userId),
        type: "credits",
        packId: pack.id,
      },
    });

    if (payment?.id && checkoutSession.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  }

  if (type === "api_access") {
    const interval = (body as { interval?: string }).interval;
    if (!isInterval(interval)) {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const price = getApiPrice(interval);

    const payment = await recordPayment({
      userId,
      amount: price.value,
      type: "api_access",
      plan: API_PRODUCT.id,
      interval,
      status: "pending",
      description: `API Access (${interval}) — awaiting payment confirmation`,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(userId),
      success_url: `${baseUrl}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?billing=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: dollarsToCents(price.value),
            recurring: {
              interval: interval === "annual" ? "year" : "month",
            },
            product_data: {
              name: "Anya.Int API Access",
              description: API_PRODUCT.description,
            },
          },
        },
      ],
      metadata: {
        paymentId: String(payment?.id ?? ""),
        userId: String(userId),
        type: "api_access",
        interval,
      },
      subscription_data: {
        metadata: {
          userId: String(userId),
          type: "api_access",
          interval,
        },
      },
    });

    if (payment?.id && checkoutSession.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  }

  return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
}
