import { SquareClient, SquareEnvironment } from "square";

export {
  decodeBillingMeta,
  encodeBillingMeta,
  type BillingMeta,
} from "@/lib/billing-meta";

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
