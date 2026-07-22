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
  resumePlan,
  schedulePlanCancel,
  syncUserPlanLifecycle,
} from "@/lib/plan-lifecycle";
import { invalidateUserPlanContext } from "@/lib/plan-access";
import {
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

  return { id: link.id, url: link.url, orderId: link.orderId ?? null };
}

export async function GET() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as number;

  await syncUserPlanLifecycle(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      billingInterval: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      subscripted: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const lastSubscription = await prisma.payment.findFirst({
    where: { userId, type: "subscription", status: "completed" },
    orderBy: { createdAt: "desc" },
    select: { description: true, plan: true, interval: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    plan: user.plan,
    billingInterval: user.billingInterval,
    planEndsAt: user.planEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    canManage:
      user.plan !== "free" && Boolean(user.subscripted || lastSubscription),
    lastPayment: lastSubscription
      ? {
          plan: lastSubscription.plan,
          interval: lastSubscription.interval,
          createdAt: lastSubscription.createdAt.toISOString(),
          description: lastSubscription.description,
        }
      : null,
  });
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

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "cancel") {
    const result = await schedulePlanCancel(userId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    invalidateUserPlanContext(userId);

    return NextResponse.json({
      ok: true,
      message: result.message,
      cancelAtPeriodEnd: result.user.cancelAtPeriodEnd,
      planEndsAt: result.user.planEndsAt?.toISOString() ?? null,
      plan: result.user.plan,
    });
  }

  if (action === "resume") {
    const result = await resumePlan(userId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    invalidateUserPlanContext(userId);

    return NextResponse.json({
      ok: true,
      message: result.message,
      cancelAtPeriodEnd: result.user.cancelAtPeriodEnd,
      planEndsAt: result.user.planEndsAt?.toISOString() ?? null,
      plan: result.user.plan,
    });
  }

  if (action === "renew") {
    const provider = (resolveBillingProvider(body) ??
      "square") as BillingProvider;

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

    await syncUserPlanLifecycle(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        billingInterval: true,
        recoveryEmail: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const lastSubscription = await prisma.payment.findFirst({
      where: { userId, type: "subscription", status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { plan: true, interval: true },
    });

    const planId =
      normalizePlanId(
        typeof body.planId === "string"
          ? body.planId
          : user.plan !== "free"
            ? user.plan
            : (lastSubscription?.plan ?? undefined),
      ) ?? null;

    const intervalRaw =
      typeof body.interval === "string"
        ? body.interval
        : user.billingInterval || lastSubscription?.interval || "monthly";
    const interval = isInterval(intervalRaw) ? intervalRaw : "monthly";

    if (!planId || planId === "free") {
      return NextResponse.json(
        { error: "Pick a plan on Pricing to renew or upgrade" },
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
      description: `${plan.name} (${interval}) renewal — awaiting payment confirmation`,
    });

    const meta: BillingMeta = {
      paymentId: String(payment?.id ?? ""),
      userId: String(userId),
      type: "subscription",
      planId,
      interval,
      provider,
    };

    const baseUrl = getAppBaseUrl(request.url);

    try {
      if (provider === "square") {
        const link = await createSquareCheckout({
          name: `Anya ${plan.name}`,
          description:
            interval === "annual"
              ? `${plan.name} renewal billed annually`
              : `${plan.name} renewal billed monthly`,
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
          provider: "square",
          message:
            "Opening card checkout. Card (Square) is required for recurring billing.",
        });
      }

      const orderId = String(payment?.id ?? crypto.randomUUID());
      const invoice = await createOxapayInvoice({
        amountUsd: price.value,
        orderId,
        description: `${plan.name} (${interval}) renewal`,
        callbackUrl: oxapayCallbackUrl(request.url),
        returnUrl: oxapayReturnUrl(request.url),
        email: user.recoveryEmail ?? undefined,
      });

      if (payment?.id) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            stripeSessionId: invoice.trackId,
            stripePaymentIntentId: orderId,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        url: invoice.paymentUrl,
        sessionId: invoice.trackId,
        provider: "oxapay",
        message:
          "Opening crypto invoice. Crypto does not auto-renew — you will need to renew again next period.",
      });
    } catch (error) {
      console.error("[billing/subscription] renew", error);

      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Renewal checkout failed",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
