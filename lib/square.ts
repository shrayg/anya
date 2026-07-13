import { SquareClient, SquareEnvironment } from "square";

let client: SquareClient | null = null;

export function isSquareConfigured(): boolean {
  return Boolean(
    process.env.SQUARE_ACCESS_TOKEN?.trim() &&
      process.env.SQUARE_LOCATION_ID?.trim(),
  );
}

export function getSquareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SQUARE_ACCESS_TOKEN is not configured");
  }

  if (!client) {
    const env =
      process.env.SQUARE_ENVIRONMENT?.trim()?.toLowerCase() === "sandbox"
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production;

    client = new SquareClient({
      token,
      environment: env,
    });
  }

  return client;
}

export function getSquareLocationId(): string {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is not configured");
  }
  return locationId;
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

export function dollarsToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

export type BillingMeta = {
  paymentId: string;
  userId: string;
  type: "subscription" | "credits" | "api_access";
  planId?: string;
  interval?: string;
  packId?: string;
};

export function encodeBillingMeta(meta: BillingMeta): string {
  return Buffer.from(JSON.stringify(meta), "utf8").toString("base64url");
}

export function decodeBillingMeta(raw: string | null | undefined): BillingMeta | null {
  if (!raw) return null;
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(text) as BillingMeta;
    if (!parsed?.userId || !parsed?.type) return null;
    return parsed;
  } catch {
    try {
      const parsed = JSON.parse(raw) as BillingMeta;
      if (!parsed?.userId || !parsed?.type) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
