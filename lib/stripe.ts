import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
    });
  }

  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getAppBaseUrl(requestUrl?: string): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");

  if (fromEnv) return fromEnv;

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // fall through
    }
  }

  return "https://anyaint.com";
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}
