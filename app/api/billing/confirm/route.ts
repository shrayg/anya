import { NextRequest, NextResponse } from "next/server";

import { fulfillBillingPayment } from "@/lib/billing-fulfillment";
import { sanitizeReturnTo } from "@/lib/search-resume";
import {
  decodeBillingMeta,
  getAppBaseUrl,
  getSquareClient,
  isSquareConfigured,
} from "@/lib/square";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

async function fulfillFromOrderId(orderId: string) {
  const client = getSquareClient();
  const orderRes = await client.orders.get({ orderId });
  const order = orderRes.order;

  if (!order) {
    return { ok: false as const, reason: "order_not_found" };
  }

  const state = order.state;
  const tenders = order.tenders ?? [];
  const paid =
    state === "OPEN" ||
    state === "COMPLETED" ||
    tenders.some((t) => Boolean(t.id));

  if (!paid) {
    return { ok: false as const, reason: "not_paid" };
  }

  // Prefer pending payment that already stored this order id
  const byOrder = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: orderId },
    orderBy: { createdAt: "desc" },
  });

  let meta = decodeBillingMeta(
    // Square may echo note on related payment; fall back to DB row fields
    undefined,
  );

  if (byOrder) {
    meta = {
      paymentId: String(byOrder.id),
      userId: String(byOrder.userId),
      type:
        byOrder.type === "balance_topup"
          ? "credits"
          : byOrder.type === "api_access"
            ? "api_access"
            : "subscription",
      planId: byOrder.plan ?? undefined,
      interval: byOrder.interval ?? undefined,
      provider: "square",
    };

    // packId recovery for credits from description / pending row alone is enough
    if (byOrder.type === "balance_topup") {
      const { CREDIT_PACK_NAME_IDS, CUSTOM_CREDIT_PACK_ID, clampCustomCredits } =
        await import("@/lib/plans");
      const packMatch = byOrder.description.match(
        /^(Starter Pack|Plus Pack|Agency Pack|Investigator Pack|Ops Pack|Custom credits)/,
      );

      if (packMatch?.[1]) {
        meta.packId = CREDIT_PACK_NAME_IDS[packMatch[1]];
      }

      if (meta.packId === CUSTOM_CREDIT_PACK_ID) {
        const amountMatch = byOrder.description.match(/\$([\d.]+)/);
        if (amountMatch?.[1]) {
          meta.creditsAmount = clampCustomCredits(Number(amountMatch[1]));
        }
      }
    }
  }

  // Try payment note from linked payment objects
  if (!meta && tenders[0]?.paymentId) {
    try {
      const payRes = await client.payments.get({
        paymentId: tenders[0].paymentId,
      });

      meta = decodeBillingMeta(payRes.payment?.note ?? undefined);
    } catch {
      // ignore
    }
  }

  if (!meta) {
    return { ok: false as const, reason: "missing_meta" };
  }

  meta = { ...meta, provider: meta.provider ?? "square" };

  const amountCents = Number(order.totalMoney?.amount ?? 0);

  return fulfillBillingPayment({
    meta,
    checkoutSessionId: byOrder?.stripeSessionId || orderId,
    paymentReferenceId: tenders[0]?.paymentId ?? orderId,
    amountCents,
  });
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.url);
  const orderId =
    request.nextUrl.searchParams.get("orderId") ||
    request.nextUrl.searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.redirect(`${baseUrl}/pricing?billing=missing_session`);
  }

  if (!isSquareConfigured()) {
    return NextResponse.redirect(
      `${baseUrl}/pricing?billing=payments_unavailable`,
    );
  }

  try {
    const result = await fulfillFromOrderId(orderId);

    if (!result.ok) {
      return NextResponse.redirect(
        `${baseUrl}/pricing?billing=pending&reason=${encodeURIComponent(result.reason)}`,
      );
    }

    if ("type" in result && result.type === "api_access") {
      return NextResponse.redirect(
        `${baseUrl}/account?billing=success`,
      );
    }

    const returnTo =
      "returnTo" in result
        ? sanitizeReturnTo(
            typeof result.returnTo === "string" ? result.returnTo : null,
          )
        : null;

    if (returnTo) {
      const sep = returnTo.includes("?") ? "&" : "?";
      const withBilling =
        returnTo.includes("billing=")
          ? returnTo
          : `${returnTo}${sep}billing=success`;

      return NextResponse.redirect(`${baseUrl}${withBilling}`);
    }

    return NextResponse.redirect(`${baseUrl}/pricing?billing=success`);
  } catch (err) {
    console.error("[square confirm] failed", err);

    return NextResponse.redirect(`${baseUrl}/pricing?billing=error`);
  }
}
