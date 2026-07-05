import {
  getDailySearchQuota,
  getPlanLabel,
  resolveUserPlan,
  type PlanId,
} from "@/lib/plans";

export type UserProfile = {
  username: string;
  isAdmin?: boolean;
  staffRole?: string | null;
  plan?: string;
  balance?: number;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
};

export type UserStats = {
  plan: PlanId;
  quota: number;
  balance: number;
  intelxUsedToday: number;
  usage: {
    last24h: number;
    last1w: number;
    last1m: number;
  };
};

export function getUserPlan(user: UserProfile | null): PlanId {
  if (!user) return "free";
  return resolveUserPlan(user);
}

export function getPlanDisplayLabel(user: UserProfile | null) {
  return getPlanLabel(getUserPlan(user));
}

export function formatAvailableSearches(stats: UserStats | null) {
  if (!stats) return "—";

  if (stats.quota === Infinity) return "∞";

  return String(Math.max(stats.quota - stats.usage.last24h, 0));
}

export function formatBalance(balance: number | undefined) {
  if (balance === undefined) return "$0.00";
  return `$${balance.toFixed(2)}`;
}

export { getDailySearchQuota };
