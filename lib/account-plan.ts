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
  billingInterval?: string;
  apiAccess?: boolean;
  apiKey?: string | null;
  recoveryEmail?: string | null;
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
  /** When the oldest search in the rolling 24h window ages out (ISO). */
  quotaRefreshAt: string | null;
  /** Estimated plan period end from last completed subscription payment (ISO). */
  planEndsAt: string | null;
  /** How the current plan period was paid. */
  billingChannel: "crypto" | "card" | "unknown" | null;
  billingInterval: "monthly" | "annual" | string | null;
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

/** Display User.balance as spendable credits (USD). */
export function formatBalance(balance: number | undefined) {
  if (balance === undefined) return "$0.00";
  return `$${balance.toFixed(2)}`;
}

export const formatCredits = formatBalance;

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatPlanEndDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export { getDailySearchQuota };
