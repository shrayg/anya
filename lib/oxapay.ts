import { createHmac, timingSafeEqual } from "crypto";

import { getAppBaseUrl } from "@/lib/square";

const OXAPAY_API = "https://api.oxapay.com/v1";

export function isOxapayConfigured(): boolean {
  return Boolean(process.env.OXAPAY_MERCHANT_API_KEY?.trim());
}

function getMerchantApiKey(): string {
  const key = process.env.OXAPAY_MERCHANT_API_KEY?.trim();
  if (!key) {
    throw new Error("OXAPAY_MERCHANT_API_KEY is not configured");
  }
  return key;
}

export function isOxapaySandbox(): boolean {
  return process.env.OXAPAY_SANDBOX?.trim()?.toLowerCase() === "true";
}

export type CreateOxapayInvoiceInput = {
  amountUsd: number;
  orderId: string;
  description: string;
  callbackUrl: string;
  returnUrl: string;
  email?: string;
  thanksMessage?: string;
};

export type OxapayInvoiceResult = {
  trackId: string;
  paymentUrl: string;
  expiredAt: number | null;
};

type OxapayInvoiceResponse = {
  data?: {
    track_id?: string | number;
    payment_url?: string;
    expired_at?: number;
  };
  message?: string;
  status?: number;
  error?: { message?: string } | null;
};

export async function createOxapayInvoice(
  input: CreateOxapayInvoiceInput,
): Promise<OxapayInvoiceResult> {
  const merchantKey = getMerchantApiKey();

  const body: Record<string, unknown> = {
    amount: input.amountUsd,
    lifetime: 60,
    order_id: input.orderId,
    description: input.description,
    callback_url: input.callbackUrl,
    return_url: input.returnUrl,
    thanks_message:
      input.thanksMessage ?? "Payment received. Your Anya.Int access will unlock shortly.",
    sandbox: isOxapaySandbox(),
  };

  if (input.email) {
    body.email = input.email;
  }

  const res = await fetch(`${OXAPAY_API}/payment/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      merchant_api_key: merchantKey,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as OxapayInvoiceResponse | null;
  if (!res.ok || !json?.data?.payment_url || json.data.track_id == null) {
    const detail =
      json?.error?.message ||
      json?.message ||
      `OxaPay invoice failed (${res.status})`;
    throw new Error(detail);
  }

  return {
    trackId: String(json.data.track_id),
    paymentUrl: json.data.payment_url,
    expiredAt:
      typeof json.data.expired_at === "number" ? json.data.expired_at : null,
  };
}

export function verifyOxapayHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
): boolean {
  if (!hmacHeader) return false;

  const key = process.env.OXAPAY_MERCHANT_API_KEY?.trim();
  if (!key) return false;

  const calculated = createHmac("sha512", key).update(rawBody).digest("hex");

  try {
    const a = new Uint8Array(Buffer.from(calculated, "utf8"));
    const b = new Uint8Array(Buffer.from(hmacHeader, "utf8"));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function oxapayCallbackUrl(requestUrl?: string): string {
  return `${getAppBaseUrl(requestUrl)}/api/billing/oxapay/webhook`;
}

export function oxapayReturnUrl(requestUrl?: string): string {
  return `${getAppBaseUrl(requestUrl)}/pricing?billing=pending`;
}

export type OxapayWebhookPayload = {
  track_id?: string | number;
  status?: string;
  type?: string;
  amount?: number;
  value?: number;
  order_id?: string;
  email?: string;
  description?: string;
};
