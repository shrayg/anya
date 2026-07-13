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
  encodeBillingMeta,
  getAppBaseUrl,
  getSquareClient,
  getSquareLocationId,
  isSquareConfigured,
  type BillingMeta,
} from "@/lib/square";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function isInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

async function createSquareCheckout(input: {
  name: string;
  description: string;
  amountDollars: number;
  meta: BillingMeta;
  baseUrl: string;
}) {
  const client = getSquareClient();
  const locationId = getSquareLocationId();
  const idempotencyKey = crypto.randomUUID();

  const result = await client.checkout.paymentLinks.create({
    idempotencyKey,
    description: input.description,
    quickPay: {
      name: input.name,
      priceMoney: {
        amount: dollarsToCents(input.amountDollars),
        currency: "USD",
      },
      locationId,
    },
    checkoutOptions: {
      redirectUrl: `${input.baseUrl}/api/billing/confirm`,
      askForShippingAddress: false,
    },
    paymentNote: encodeBillingMeta(input.meta),
  });

  const link = result.paymentLink;
  if (!link?.id || !link.url) {
    throw new Error("Square did not return a payment link");
  }

  return {
    id: link.id,
    url: link.url,
    orderId: link.orderId ?? null,
  };
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSquareConfigured()) {
    return NextResponse.json(
      { error: "Square is not configured on this server" },
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
    select: { id: true, username: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const type = (body as { type?: string }).type;
  const baseUrl = getAppBaseUrl(request.url);

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

    const meta: BillingMeta = {
      paymentId: String(payment?.id ?? ""),
      userId: String(userId),
      type: "subscription",
      planId,
      interval,
    };

    const link = await createSquareCheckout({
      name: `Anya.Int ${plan.name}`,
      description:
        interval === "annual"
          ? `${plan.name} plan billed annually`
          : `${plan.name} plan billed monthly`,
      amountDollars: price.value,
      meta,
      baseUrl,
    });

    if (payment?.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeSessionId: link.id,
          stripePaymentIntentId: link.orderId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      url: link.url,
      sessionId: link.id,
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

    const meta: BillingMeta = {
      paymentId: String(payment?.id ?? ""),
      userId: String(userId),
      type: "credits",
      packId: pack.id,
    };

    const link = await createSquareCheckout({
      name: `Anya.Int ${pack.name}`,
      description: `$${creditTotal.toFixed(2)} investigation credit`,
      amountDollars: pack.price,
      meta,
      baseUrl,
    });

    if (payment?.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeSessionId: link.id,
          stripePaymentIntentId: link.orderId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      url: link.url,
      sessionId: link.id,
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

    const meta: BillingMeta = {
      paymentId: String(payment?.id ?? ""),
      userId: String(userId),
      type: "api_access",
      interval,
    };

    const link = await createSquareCheckout({
      name: "Anya.Int API Access",
      description: API_PRODUCT.description,
      amountDollars: price.value,
      meta,
      baseUrl,
    });

    if (payment?.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeSessionId: link.id,
          stripePaymentIntentId: link.orderId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      url: link.url,
      sessionId: link.id,
    });
  }

  return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
}
