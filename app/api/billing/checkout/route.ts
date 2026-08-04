import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import {
  type BillingMeta,
  type BillingProvider,
  encodeBillingMeta,
  resolveBillingProvider,
} from "@/lib/billing-meta";
import {
  createOxapayInvoice,
  isOxapayConfigured,
  oxapayCallbackUrl,
  oxapayReturnUrl,
} from "@/lib/oxapay";
import {
  API_PRODUCT,
  CREDIT_PACKS,
  CUSTOM_CREDIT_MAX,
  CUSTOM_CREDIT_MIN,
  CUSTOM_CREDIT_PACK_ID,
  clampCustomCredits,
  customCreditsPrice,
  getApiPrice,
  getCreditPackBonus,
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
  getSquareClient,
  getSquareLocationId,
  isSquareConfigured,
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

async function finalizeCheckout(input: {
  provider: BillingProvider;
  paymentId: number | undefined;
  name: string;
  description: string;
  amountDollars: number;
  meta: BillingMeta;
  baseUrl: string;
  requestUrl: string;
  email?: string;
}) {
  const meta: BillingMeta = { ...input.meta, provider: input.provider };

  if (input.provider === "square") {
    const link = await createSquareCheckout({
      name: input.name,
      description: input.description,
      amountDollars: input.amountDollars,
      meta,
      baseUrl: input.baseUrl,
    });

    if (input.paymentId) {
      await prisma.payment.update({
        where: { id: input.paymentId },
        data: {
          stripeSessionId: link.id,
          stripePaymentIntentId: link.orderId,
        },
      });
    }

    return {
      ok: true as const,
      url: link.url,
      sessionId: link.id,
      provider: "square" as const,
    };
  }

  const orderId = String(
    input.paymentId ?? (meta.paymentId || crypto.randomUUID()),
  );
  const invoice = await createOxapayInvoice({
    amountUsd: input.amountDollars,
    orderId,
    description: `${input.name} — ${input.description}`,
    callbackUrl: oxapayCallbackUrl(input.requestUrl),
    returnUrl: oxapayReturnUrl(input.requestUrl),
    email: input.email,
  });

  if (input.paymentId) {
    await prisma.payment.update({
      where: { id: input.paymentId },
      data: {
        stripeSessionId: invoice.trackId,
        stripePaymentIntentId: orderId,
      },
    });
  }

  return {
    ok: true as const,
    url: invoice.paymentUrl,
    sessionId: invoice.trackId,
    provider: "oxapay" as const,
  };
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as number;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const provider = resolveBillingProvider(body) ?? "square";

  if (provider === "square" && !isSquareConfigured()) {
    return NextResponse.json(
      { error: "Card checkout (Square) is not configured on this server" },
      { status: 503 },
    );
  }
  if (provider === "oxapay" && !isOxapayConfigured()) {
    return NextResponse.json(
      { error: "Crypto checkout (OxaPay) is not configured on this server" },
      { status: 503 },
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const type = body.type;
  const baseUrl = getAppBaseUrl(request.url);

  try {
    if (type === "subscription") {
      const planId = normalizePlanId(
        typeof body.planId === "string" ? body.planId : undefined,
      );
      const interval = body.interval;

      if (!planId || planId === "free") {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      if (!isInterval(interval)) {
        return NextResponse.json(
          { error: "Invalid billing interval" },
          { status: 400 },
        );
      }

      const plan = getPlanDefinition(planId as PlanId);
      const price = getPlanPrice(plan, interval);

      if (price.value == null) {
        return NextResponse.json(
          { error: "Plan requires sales contact" },
          { status: 400 },
        );
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
        provider,
      };

      const result = await finalizeCheckout({
        provider,
        paymentId: payment?.id,
        name: `Anya ${plan.name}`,
        description:
          interval === "annual"
            ? `${plan.name} plan billed annually`
            : `${plan.name} plan billed monthly`,
        amountDollars: price.value,
        meta,
        baseUrl,
        requestUrl: request.url,
      });

      return NextResponse.json(result);
    }

    if (type === "credits") {
      const packId = typeof body.packId === "string" ? body.packId : undefined;
      const rawCustom =
        typeof body.creditsAmount === "number"
          ? body.creditsAmount
          : typeof body.creditsAmount === "string"
            ? Number(body.creditsAmount)
            : NaN;

      if (packId === CUSTOM_CREDIT_PACK_ID || Number.isFinite(rawCustom)) {
        if (!Number.isFinite(rawCustom)) {
          return NextResponse.json(
            { error: "Enter how many credits you want" },
            { status: 400 },
          );
        }

        const requested = Math.round(rawCustom);

        if (
          requested < CUSTOM_CREDIT_MIN ||
          requested > CUSTOM_CREDIT_MAX
        ) {
          return NextResponse.json(
            {
              error: `Choose between ${CUSTOM_CREDIT_MIN} and ${CUSTOM_CREDIT_MAX} credits`,
            },
            { status: 400 },
          );
        }

        const creditsAmount = clampCustomCredits(requested);
        const price = customCreditsPrice(creditsAmount);

        const payment = await recordPayment({
          userId,
          amount: price,
          type: "balance_topup",
          status: "pending",
          description: `Custom credits: $${creditsAmount.toFixed(2)} credit (pending payment)`,
        });

        const meta: BillingMeta = {
          paymentId: String(payment?.id ?? ""),
          userId: String(userId),
          type: "credits",
          packId: CUSTOM_CREDIT_PACK_ID,
          creditsAmount,
          provider,
        };

        const result = await finalizeCheckout({
          provider,
          paymentId: payment?.id,
          name: "Anya Custom credits",
          description: `${creditsAmount} credits at $1.00 each`,
          amountDollars: price,
          meta,
          baseUrl,
          requestUrl: request.url,
        });

        return NextResponse.json(result);
      }

      const pack = CREDIT_PACKS.find((entry) => entry.id === packId);

      if (!pack) {
        return NextResponse.json(
          { error: "Invalid credit pack" },
          { status: 400 },
        );
      }

      const creditTotal = getCreditPackTotal(pack);
      const bonus = getCreditPackBonus(pack);

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
        creditsAmount: creditTotal,
        provider,
      };

      const result = await finalizeCheckout({
        provider,
        paymentId: payment?.id,
        name: `Anya ${pack.name}`,
        description: `${creditTotal} credits (${pack.discountPercent}% bulk bonus${bonus > 0 ? `, +${bonus}` : ""})`,
        amountDollars: pack.price,
        meta,
        baseUrl,
        requestUrl: request.url,
      });

      return NextResponse.json(result);
    }

    if (type === "api_access") {
      const interval = body.interval;

      if (!isInterval(interval)) {
        return NextResponse.json(
          { error: "Invalid billing interval" },
          { status: 400 },
        );
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
        provider,
      };

      const result = await finalizeCheckout({
        provider,
        paymentId: payment?.id,
        name: "Anya API Access",
        description: API_PRODUCT.description,
        amountDollars: price.value,
        meta,
        baseUrl,
        requestUrl: request.url,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Unknown checkout type" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[billing/checkout]", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Checkout failed",
      },
      { status: 502 },
    );
  }
}
