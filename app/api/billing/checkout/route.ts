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
  planUpdatesFromId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { recordPayment } from "@/lib/payments";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function isInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as number;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const type = (body as { type?: string }).type;

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

    await recordPayment({
      userId,
      amount: price.value,
      type: "subscription",
      plan: planId,
      interval,
      status: "pending",
      description: `${plan.name} (${interval}) — awaiting payment confirmation`,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...planUpdatesFromId(planId),
        billingInterval: interval,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${plan.name} activated. Payment is pending confirmation.`,
      planId,
      interval,
      amount: price.value,
    });
  }

  if (type === "credits") {
    const packId = (body as { packId?: string }).packId;
    const pack = CREDIT_PACKS.find((entry) => entry.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const creditTotal = getCreditPackTotal(pack);

    await recordPayment({
      userId,
      amount: pack.price,
      type: "balance_topup",
      status: "pending",
      description: `${pack.name}: $${creditTotal.toFixed(2)} credit (pending payment)`,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: creditTotal } },
    });

    return NextResponse.json({
      ok: true,
      message: `$${creditTotal.toFixed(2)} credit added. Payment recorded as pending.`,
      credits: creditTotal,
    });
  }

  if (type === "api_access") {
    const interval = (body as { interval?: string }).interval;
    if (!isInterval(interval)) {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const price = getApiPrice(interval);
    const apiKey = `anya_${crypto.randomUUID().replace(/-/g, "")}`;

    await recordPayment({
      userId,
      amount: price.value,
      type: "api_access",
      plan: API_PRODUCT.id,
      interval,
      status: "pending",
      description: `API Access (${interval}) — key issued pending payment confirmation`,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        apiAccess: true,
        apiKey,
        billingInterval: interval,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "API access enabled. Your key is available in Settings.",
      amount: price.value,
      interval,
    });
  }

  return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
}
