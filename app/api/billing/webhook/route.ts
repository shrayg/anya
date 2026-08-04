import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { fulfillBillingPayment } from "@/lib/billing-fulfillment";
import {
  decodeBillingMeta,
  isSquareConfigured,
  type BillingMeta,
} from "@/lib/square";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

function verifySquareSignature(
  body: string,
  signatureHeader: string | null,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  if (!signatureHeader) return false;

  const payload = notificationUrl + body;
  const hmac = createHmac("sha256", signatureKey)
    .update(payload)
    .digest("base64");

  try {
    const a = new Uint8Array(Buffer.from(hmac));
    const b = new Uint8Array(Buffer.from(signatureHeader));

    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function metaFromPaymentNote(
  note: string | null | undefined,
  orderId: string | null | undefined,
): Promise<BillingMeta | null> {
  const fromNote = decodeBillingMeta(note);

  if (fromNote) return fromNote;

  if (!orderId) return null;

  const byOrder = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: orderId },
    orderBy: { createdAt: "desc" },
  });

  if (!byOrder) return null;

  const meta: BillingMeta = {
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

  if (byOrder.type === "balance_topup") {
    const { CREDIT_PACK_NAME_IDS, CUSTOM_CREDIT_PACK_ID, clampCustomCredits } =
      await import("@/lib/plans");
    const packMatch = byOrder.description.match(
      /^(Starter Pack|Plus Pack|Agency Pack|Investigator Pack|Ops Pack|Custom credits)/,
    );

    if (packMatch?.[1]) meta.packId = CREDIT_PACK_NAME_IDS[packMatch[1]];

    if (meta.packId === CUSTOM_CREDIT_PACK_ID) {
      const amountMatch = byOrder.description.match(/\$([\d.]+)/);
      if (amountMatch?.[1]) {
        meta.creditsAmount = clampCustomCredits(Number(amountMatch[1]));
      }
    }
  }

  return meta;
}

export async function POST(request: NextRequest) {
  if (!isSquareConfigured()) {
    return NextResponse.json(
      { error: "Square not configured" },
      { status: 503 },
    );
  }

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  const notificationUrl =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ||
    "https://anyaint.com/api/billing/webhook";

  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  if (signatureKey) {
    const valid = verifySquareSignature(
      rawBody,
      signature,
      signatureKey,
      notificationUrl,
    );

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: {
    type?: string;
    data?: {
      object?: {
        payment?: Record<string, unknown>;
        order?: Record<string, unknown>;
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (
      event.type === "payment.updated" ||
      event.type === "payment.completed"
    ) {
      const payment = event.data?.object?.payment as
        | {
            id?: string;
            status?: string;
            orderId?: string;
            note?: string;
            amountMoney?: { amount?: number | string };
          }
        | undefined;

      if (payment?.status === "COMPLETED") {
        const meta = await metaFromPaymentNote(payment.note, payment.orderId);

        if (meta) {
          const pending = meta.paymentId
            ? await prisma.payment.findUnique({
                where: { id: Number(meta.paymentId) },
              })
            : null;

          await fulfillBillingPayment({
            meta,
            checkoutSessionId:
              pending?.stripeSessionId ||
              payment.orderId ||
              payment.id ||
              "square",
            paymentReferenceId: payment.id ?? null,
            amountCents: Number(payment.amountMoney?.amount ?? 0),
          });
        }
      }
    }

    if (event.type === "order.updated") {
      const order = event.data?.object?.order as
        | {
            id?: string;
            state?: string;
            totalMoney?: { amount?: number | string };
            tenders?: Array<{ paymentId?: string }>;
          }
        | undefined;

      if (
        order?.id &&
        (order.state === "OPEN" || order.state === "COMPLETED")
      ) {
        const meta = await metaFromPaymentNote(undefined, order.id);

        if (meta) {
          const pending = meta.paymentId
            ? await prisma.payment.findUnique({
                where: { id: Number(meta.paymentId) },
              })
            : null;

          await fulfillBillingPayment({
            meta,
            checkoutSessionId: pending?.stripeSessionId || order.id,
            paymentReferenceId: order.tenders?.[0]?.paymentId ?? order.id,
            amountCents: Number(order.totalMoney?.amount ?? 0),
          });
        }
      }
    }
  } catch (err) {
    console.error("[square webhook] fulfillment failed", err);

    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
