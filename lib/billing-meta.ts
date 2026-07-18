export type BillingMeta = {
  paymentId: string;
  userId: string;
  type: "subscription" | "credits" | "api_access";
  planId?: string;
  interval?: string;
  packId?: string;
  /** Payment rail used for this checkout. */
  provider?: "square" | "oxapay";
};

export type BillingProvider = "square" | "oxapay";

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

/** Normalize UI/API aliases to a billing provider. */
export function resolveBillingProvider(
  body: Record<string, unknown>,
): BillingProvider | null {
  const provider = body.provider;
  const method = body.method;

  if (provider === "square" || provider === "oxapay") return provider;
  if (method === "card") return "square";
  if (method === "crypto") return "oxapay";
  return null;
}
