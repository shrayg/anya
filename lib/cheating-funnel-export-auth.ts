import "server-only";

import { prisma } from "@/prisma/client";

/**
 * Prove the signed-in user unlocked this funnel report before PDF/email export.
 * Accepts a vault claimed by this user, or a completed search_unlock payment
 * that references the vault id in payment.plan.
 */
export async function assertCheatingReportExportAccess(input: {
  userId: number;
  vaultId: string | null | undefined;
}): Promise<
  | { ok: true; vaultId: string }
  | { ok: false; error: string; status: number }
> {
  const vaultId = typeof input.vaultId === "string" ? input.vaultId.trim() : "";

  if (!vaultId || vaultId.length > 64) {
    return {
      ok: false,
      error: "Unlock the report before exporting.",
      status: 403,
    };
  }

  const vault = await prisma.searchResultVault.findUnique({
    where: { id: vaultId },
    select: {
      id: true,
      claimedAt: true,
      claimedByUserId: true,
      expiresAt: true,
    },
  });

  if (
    vault?.claimedAt &&
    vault.claimedByUserId === input.userId &&
    vault.expiresAt.getTime() >= Date.now()
  ) {
    return { ok: true, vaultId: vault.id };
  }

  const paidUnlock = await prisma.payment.findFirst({
    where: {
      userId: input.userId,
      type: "search_unlock",
      status: "completed",
      plan: vaultId,
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (paidUnlock) {
    return { ok: true, vaultId };
  }

  return {
    ok: false,
    error: "Unlock the report before exporting.",
    status: 403,
  };
}
