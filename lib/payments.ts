import { prisma } from "@/prisma/client";

export type PaymentType =
  | "subscription"
  | "balance_topup"
  | "module_usage"
  | "api_access"
  | "search_unlock"
  | "manual";

type RecordPaymentInput = {
  userId: number;
  amount: number;
  type: PaymentType;
  plan?: string | null;
  interval?: string | null;
  status?: "completed" | "pending" | "failed" | "refunded";
  description?: string;
};

export async function recordPayment(input: RecordPaymentInput) {
  if (input.amount <= 0 && input.status !== "pending") {
    return null;
  }

  return prisma.payment.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      plan: input.plan ?? null,
      interval: input.interval ?? null,
      status: input.status ?? "completed",
      description: input.description ?? "",
    },
  });
}
