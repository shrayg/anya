import type { BillingMeta } from "@/lib/billing-meta";

import { NextRequest, NextResponse } from "next/server";

import { fulfillBillingPayment } from "@/lib/billing-fulfillment";
import {
  type OxapayWebhookPayload,
  isOxapayConfigured,
  verifyOxapayHmac,
} from "@/lib/oxapay";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function oxapayOk() {
  return new NextResponse("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function metaFromPaymentRow(row: {
  id: number;
  userId: number;
  type: string;
  plan: string | null;
  interval: string | null;
  description: string;
}): BillingMeta {
  const meta: BillingMeta = {
    paymentId: String(row.id),
    userId: String(row.userId),
    type:
      row.type === "balance_topup"
        ? "credits"
        : row.type === "api_access"
          ? "api_access"
          : "subscription",
    planId: row.plan ?? undefined,
    interval: row.interval ?? undefined,
    provider: "oxapay",
  };

  if (row.type === "balance_topup") {
    const packMatch = row.description.match(
      /^(Starter Pack|Investigator Pack|Ops Pack|Agency Pack)/,
    );
    const packIdMap: Record<string, string> = {
      "Starter Pack": "credits_10",
      "Investigator Pack": "credits_25",
      "Ops Pack": "credits_50",
      "Agency Pack": "credits_100",
    };

    if (packMatch?.[1]) meta.packId = packIdMap[packMatch[1]];
  }

  return meta;
}

export async function POST(request: NextRequest) {
  if (!isOxapayConfigured()) {
    return new NextResponse("oxapay_unavailable", { status: 503 });
  }

  const rawBody = await request.text();
  const hmacHeader = request.headers.get("hmac") ?? request.headers.get("HMAC");

  if (!verifyOxapayHmac(rawBody, hmacHeader)) {
    return new NextResponse("invalid_hmac", { status: 400 });
  }

  let payload: OxapayWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as OxapayWebhookPayload;
  } catch {
    return new NextResponse("invalid_json", { status: 400 });
  }

  const status = String(payload.status ?? "").toLowerCase();

  // Acknowledge non-paid updates so OxaPay stops retrying; only Paid fulfills.
  if (status !== "paid") {
    return oxapayOk();
  }

  const trackId = payload.track_id != null ? String(payload.track_id) : null;
  const orderId = payload.order_id ? String(payload.order_id) : null;

  const payment =
    (orderId && Number.isFinite(Number(orderId))
      ? await prisma.payment.findUnique({ where: { id: Number(orderId) } })
      : null) ??
    (trackId
      ? await prisma.payment.findFirst({
          where: { stripeSessionId: trackId },
          orderBy: { createdAt: "desc" },
        })
      : null) ??
    (orderId
      ? await prisma.payment.findFirst({
          where: { stripePaymentIntentId: orderId },
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!payment) {
    console.error("[oxapay/webhook] payment not found", { trackId, orderId });

    // Still return ok to avoid endless retries for unknown/orphan invoices
    return oxapayOk();
  }

  const meta = metaFromPaymentRow(payment);
  const amountCents = Math.round(payment.amount * 100);

  const result = await fulfillBillingPayment({
    meta,
    checkoutSessionId: trackId ?? payment.stripeSessionId ?? String(payment.id),
    paymentReferenceId: orderId ?? trackId,
    amountCents,
  });

  if (!result.ok) {
    console.error("[oxapay/webhook] fulfill failed", result);
  }

  return oxapayOk();
}
