/**
 * Server-side search result vault — full payloads never leave the server on teaser.
 * Clients receive vaultId + claimToken; claim returns clear JSON after auth + plan/credits.
 */

import { createHash, randomBytes } from "crypto";

import {
  SEARCH_UNLOCK_CREDIT_COST,
  SEARCH_UNLOCK_MODULE_SLUG,
  creditsCanUnlockModuleClass,
  getModuleAccessClass,
  planMeetsModuleClass,
  type ModuleAccessClass,
  type PlanId,
} from "@/lib/plans";
import { authorizeSearch, recordSearchUsage } from "@/lib/plan-access";
import { prisma } from "@/prisma/client";

export const SEARCH_VAULT_TTL_MS = 24 * 60 * 60 * 1000;
export const SEARCH_RESUME_STORAGE_KEY = "anya:search-resume-v1";

export type VaultUnlockMeta = {
  reasons: string[];
  creditCost: number;
  planRequired: PlanId | null;
  allowCreditUnlock: boolean;
  accessClass: ModuleAccessClass;
  resultCount?: number;
};

export type CreateVaultInput = {
  moduleSlug: string;
  query: string;
  payload: unknown;
  userId?: number | null;
  ipHash?: string | null;
  unlockMode?: "teaser" | "premium_section";
  resultCount?: number;
  /** Server-selected one-time credit price for a dedicated funnel offer. */
  creditCost?: number;
};

export type CreateVaultResult = {
  vaultId: string;
  claimToken: string;
  unlock: VaultUnlockMeta;
  expiresAt: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashQuery(query: string): string {
  return createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function hashClientIp(ip: string): string {
  return hashIp(ip);
}

function buildUnlockMeta(
  moduleSlug: string,
  resultCount?: number,
  creditCostOverride?: number,
): VaultUnlockMeta {
  const accessClass = getModuleAccessClass(moduleSlug);
  const allowCreditUnlock = creditsCanUnlockModuleClass(accessClass);
  const planRequired: PlanId = accessClass === "S" ? "starter" : "professional";
  const reasons: string[] = [];

  if (accessClass === "S") {
    reasons.push("Sign in and buy a plan, or unlock this search with credits.");
  } else if (accessClass === "I") {
    reasons.push(
      "This section is included on Professional+. Unlock with 1 credit or upgrade.",
    );
  } else if (accessClass === "P") {
    reasons.push(
      "This module requires Professional or higher (credits alone cannot unlock).",
    );
  } else {
    reasons.push("This search requires credits or a qualifying plan.");
  }

  return {
    reasons,
    creditCost: allowCreditUnlock
      ? typeof creditCostOverride === "number" &&
        Number.isFinite(creditCostOverride) &&
        creditCostOverride > 0
        ? creditCostOverride
        : SEARCH_UNLOCK_CREDIT_COST
      : 0,
    planRequired: accessClass === "P" ? "professional" : planRequired,
    allowCreditUnlock,
    accessClass,
    resultCount,
  };
}

function extractResultCount(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const row = payload as Record<string, unknown>;

  if (typeof row.count === "number") return row.count;
  if (typeof row.returned === "number") return row.returned;
  if (typeof row.totalMatches === "number") return row.totalMatches;
  if (Array.isArray(row.results)) return row.results.length;
  if (Array.isArray(row.credentials)) return row.credentials.length;
  if (Array.isArray(row.found)) return row.found.length;

  return 0;
}

export async function createSearchResultVault(
  input: CreateVaultInput,
): Promise<CreateVaultResult> {
  const claimToken = randomBytes(24).toString("hex");
  const claimTokenHash = hashToken(claimToken);
  const resultCount = input.resultCount ?? extractResultCount(input.payload);
  const unlock = buildUnlockMeta(
    input.moduleSlug,
    resultCount,
    input.creditCost,
  );
  const expiresAt = new Date(Date.now() + SEARCH_VAULT_TTL_MS);
  const id = randomBytes(16).toString("hex");

  await prisma.searchResultVault.create({
    data: {
      id,
      claimTokenHash,
      moduleSlug: input.moduleSlug,
      queryHash: hashQuery(input.query || ""),
      queryPreview: (input.query || "").slice(0, 120),
      payload: JSON.stringify(input.payload ?? null),
      metaJson: JSON.stringify({
        unlock,
        resultCount,
      }),
      userId: input.userId ?? null,
      ipHash: input.ipHash ?? null,
      unlockMode: input.unlockMode ?? "teaser",
      planRequired: unlock.planRequired,
      creditCost: unlock.creditCost,
      allowCreditUnlock: unlock.allowCreditUnlock,
      expiresAt,
    },
  });

  return {
    vaultId: id,
    claimToken,
    unlock,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getSearchVaultMeta(vaultId: string) {
  const row = await prisma.searchResultVault.findUnique({
    where: { id: vaultId },
  });

  if (!row) return null;

  let unlock: VaultUnlockMeta | null = null;

  try {
    const meta = JSON.parse(row.metaJson) as { unlock?: VaultUnlockMeta };
    unlock = meta.unlock ?? buildUnlockMeta(row.moduleSlug);
  } catch {
    unlock = buildUnlockMeta(row.moduleSlug);
  }

  return {
    vaultId: row.id,
    moduleSlug: row.moduleSlug,
    queryPreview: row.queryPreview,
    expiresAt: row.expiresAt.toISOString(),
    claimed: Boolean(row.claimedAt),
    unlock,
  };
}

export type ClaimVaultResult =
  | {
      ok: true;
      payload: unknown;
      moduleSlug: string;
      chargedCredits: number;
    }
  | { ok: false; error: string; status: number; requiresBalance?: boolean };

export async function claimSearchResultVault(input: {
  vaultId: string;
  claimToken: string;
  userId: number;
  /** Prefer debiting credits even if plan would clear (explicit unlock). */
  preferCreditUnlock?: boolean;
}): Promise<ClaimVaultResult> {
  const row = await prisma.searchResultVault.findUnique({
    where: { id: input.vaultId },
  });

  if (!row) {
    return {
      ok: false,
      error: "Search unlock expired or not found.",
      status: 404,
    };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This search unlock has expired. Run the search again.",
      status: 410,
    };
  }

  if (row.claimTokenHash !== hashToken(input.claimToken)) {
    return { ok: false, error: "Invalid unlock token.", status: 403 };
  }

  if (
    row.claimedAt &&
    row.claimedByUserId &&
    row.claimedByUserId !== input.userId
  ) {
    return {
      ok: false,
      error: "This search was already unlocked on another account.",
      status: 403,
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(row.payload);
  } catch {
    return {
      ok: false,
      error: "Stored search payload is corrupt.",
      status: 500,
    };
  }

  // Already claimed by this user — return payload without re-charging.
  if (row.claimedAt && row.claimedByUserId === input.userId) {
    return {
      ok: true,
      payload,
      moduleSlug: row.moduleSlug,
      chargedCredits: 0,
    };
  }

  const accessClass = getModuleAccessClass(row.moduleSlug);
  const auth = await authorizeSearch({
    userId: input.userId,
    moduleSlug: row.moduleSlug,
  });

  const plan = "plan" in auth && auth.plan ? auth.plan : ("free" as PlanId);
  const planOk = planMeetsModuleClass(plan, accessClass);
  const allowCredits =
    row.allowCreditUnlock && creditsCanUnlockModuleClass(accessClass);

  let chargedCredits = 0;

  if (accessClass === "P" && !planOk) {
    return {
      ok: false,
      error:
        "This module requires Professional or higher. Credits cannot unlock plan-seat tools.",
      status: 403,
    };
  }

  if (!planOk || input.preferCreditUnlock) {
    if (!allowCredits) {
      return {
        ok: false,
        error: "Upgrade your plan to unlock these results.",
        status: 403,
      };
    }

    const unlockAuth = await authorizeSearch({
      userId: input.userId,
      moduleSlug: SEARCH_UNLOCK_MODULE_SLUG,
    });

    if (!unlockAuth.allowed) {
      return {
        ok: false,
        error:
          "reason" in unlockAuth
            ? unlockAuth.reason || "Not enough credits to unlock."
            : "Not enough credits to unlock.",
        status: 403,
        requiresBalance: true,
      };
    }

    const cost =
      typeof row.creditCost === "number" && row.creditCost > 0
        ? row.creditCost
        : SEARCH_UNLOCK_CREDIT_COST;

    if (
      !("balance" in unlockAuth) ||
      typeof unlockAuth.balance !== "number" ||
      unlockAuth.balance < cost
    ) {
      return {
        ok: false,
        error: `Unlocking this report costs $${cost.toFixed(2)}.`,
        status: 403,
        requiresBalance: true,
      };
    }

    await recordSearchUsage(input.userId, SEARCH_UNLOCK_MODULE_SLUG, cost);
    chargedCredits = cost;
  }

  await prisma.searchResultVault.update({
    where: { id: row.id },
    data: {
      claimedAt: new Date(),
      claimedByUserId: input.userId,
      userId: row.userId ?? input.userId,
    },
  });

  return {
    ok: true,
    payload,
    moduleSlug: row.moduleSlug,
    chargedCredits,
  };
}

export async function fulfillPurchasedSearchVault(
  input: {
    vaultId: string;
    userId: number;
  },
  tx: {
    searchResultVault: {
      findUnique: typeof prisma.searchResultVault.findUnique;
      updateMany: typeof prisma.searchResultVault.updateMany;
    };
  } = prisma,
) {
  const row = await tx.searchResultVault.findUnique({
    where: { id: input.vaultId },
  });

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "vault_expired" as const };
  }

  if (row.claimedByUserId && row.claimedByUserId !== input.userId) {
    return {
      ok: false as const,
      reason: "vault_claimed_by_another_user" as const,
    };
  }

  if (row.claimedAt && row.claimedByUserId === input.userId) {
    return { ok: true as const, alreadyUnlocked: true };
  }

  const claimed = await tx.searchResultVault.updateMany({
    where: {
      id: row.id,
      claimedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      claimedAt: new Date(),
      claimedByUserId: input.userId,
      userId: row.userId ?? input.userId,
    },
  });

  if (claimed.count === 1) {
    return { ok: true as const, alreadyUnlocked: false };
  }

  // Lost the race to another worker — re-check ownership.
  const again = await tx.searchResultVault.findUnique({
    where: { id: row.id },
    select: { claimedAt: true, claimedByUserId: true },
  });

  if (again?.claimedAt && again.claimedByUserId === input.userId) {
    return { ok: true as const, alreadyUnlocked: true };
  }

  if (again?.claimedByUserId && again.claimedByUserId !== input.userId) {
    return {
      ok: false as const,
      reason: "vault_claimed_by_another_user" as const,
    };
  }

  return { ok: false as const, reason: "vault_expired" as const };
}

/** Best-effort delete of expired vaults (call from claim/create occasionally). */
export async function purgeExpiredSearchVaults(limit = 50): Promise<number> {
  const expired = await prisma.searchResultVault.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true },
    take: limit,
  });

  if (expired.length === 0) return 0;

  await prisma.searchResultVault.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });

  return expired.length;
}
