import { prisma } from "@/prisma/client";

type RecordPaymentInput = {
  userId: number;
  amount: number;
  type: "subscription" | "balance_topup" | "module_usage" | "manual";
  plan?: string | null;
  status?: "completed" | "pending" | "failed" | "refunded";
  description?: string;
};

export async function recordPayment(input: RecordPaymentInput) {
  if (input.amount <= 0) {
    return null;
  }

  return prisma.payment.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      plan: input.plan ?? null,
      status: input.status ?? "completed",
      description: input.description ?? "",
    },
  });
}
