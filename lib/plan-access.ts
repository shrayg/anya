import {
  checkDailySearchQuota,
  checkModuleAccess,
  getDailySearchQuota,
  PAY_PER_USE_COST,
  resolveUserPlan,
  type PlanId,
  type SearchAccessResult,
} from "@/lib/plans";
import { recordPayment } from "@/lib/payments";
import { syncUserPlanLifecycle } from "@/lib/plan-lifecycle";
import {
  getAccountStatusMessage,
  isAccountBlocked,
} from "@/lib/workspace-admin";
import { prisma } from "@/prisma/client";

export type AuthorizeSearchInput = {
  userId: number;
  moduleSlug: string;
};

export type AuthorizeSearchResult = SearchAccessResult & {
  plan: PlanId;
  quota: number;
  searchesLast24h: number;
  balance: number;
  intelxUsedToday: number;
};

type PlanContextCacheEntry = {
  expiresAt: number;
  value: Awaited<ReturnType<typeof buildUserPlanContext>>;
};

const PLAN_CONTEXT_CACHE = new Map<number, PlanContextCacheEntry>();
const PLAN_CONTEXT_TTL_MS = 15_000;

async function buildUserPlanContext(userId: number) {
  await syncUserPlanLifecycle(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      balance: true,
      accountStatus: true,
      freeTier: true,
      professionalTier: true,
      investigatorTier: true,
      enterpriseTier: true,
      planEndsAt: true,
      cancelAtPeriodEnd: true,
      billingInterval: true,
      isAdmin: true,
      staffRole: true,
    },
  });

  if (!user) return null;

  if (isAccountBlocked(user.accountStatus)) {
    return {
      blocked: true,
      reason:
        getAccountStatusMessage(user.accountStatus) ?? "Account restricted.",
      plan: resolveUserPlan(user),
      balance: user.balance ?? 0,
      quota: 0,
      searchesLast24h: 0,
      intelxUsedToday: 0,
    };
  }

  const plan = resolveUserPlan(user);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [searchesLast24h, intelxUsedToday] = await Promise.all([
    prisma.searchHistory.count({
      where: { userId, createdAt: { gte: oneDayAgo } },
    }),
    prisma.searchHistory.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
        searchType: "intelx",
      },
    }),
  ]);

  return {
    plan,
    balance: user.balance ?? 0,
    quota: getDailySearchQuota(plan),
    searchesLast24h,
    intelxUsedToday,
    planEndsAt: user.planEndsAt,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    billingInterval: user.billingInterval ?? "monthly",
  };
}

export async function getUserPlanContext(userId: number) {
  const cached = PLAN_CONTEXT_CACHE.get(userId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await buildUserPlanContext(userId);

  if (value) {
    PLAN_CONTEXT_CACHE.set(userId, {
      value,
      expiresAt: now + PLAN_CONTEXT_TTL_MS,
    });
  }

  return value;
}

export function invalidateUserPlanContext(userId: number) {
  PLAN_CONTEXT_CACHE.delete(userId);
}

export async function authorizeSearch(
  input: AuthorizeSearchInput,
): Promise<AuthorizeSearchResult | { allowed: false; reason: string }> {
  const context = await getUserPlanContext(input.userId);

  if (!context) {
    return { allowed: false, reason: "User not found." };
  }

  if ("blocked" in context && context.blocked) {
    return { allowed: false, reason: context.reason };
  }

  const quotaCheck = checkDailySearchQuota(
    context.plan,
    context.searchesLast24h,
  );

  if (!quotaCheck.allowed) {
    return {
      ...quotaCheck,
      plan: context.plan,
      quota: context.quota,
      searchesLast24h: context.searchesLast24h,
      balance: context.balance,
      intelxUsedToday: context.intelxUsedToday,
    };
  }

  const moduleCheck = checkModuleAccess(context.plan, input.moduleSlug, {
    balance: context.balance,
    intelxUsedToday: context.intelxUsedToday,
  });

  return {
    ...moduleCheck,
    plan: context.plan,
    quota: context.quota,
    searchesLast24h: context.searchesLast24h,
    balance: context.balance,
    intelxUsedToday: context.intelxUsedToday,
  };
}

export async function recordSearchUsage(
  userId: number,
  moduleSlug: string,
  balanceCost?: number,
) {
  if (!balanceCost || balanceCost <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      balance: {
        decrement: balanceCost,
      },
    },
  });

  await recordPayment({
    userId,
    amount: balanceCost,
    type: "module_usage",
    description: `${moduleSlug} search charge`,
  });
}

export { PAY_PER_USE_COST };
