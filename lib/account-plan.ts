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
  /** Daily search limit for the plan. `Infinity` (or null from JSON) = unlimited. */
  quota: number;
  balance: number;
  intelxUsedToday: number;
  /** When the oldest search in the rolling 24h window ages out (ISO). */
  quotaRefreshAt: string | null;
  /** Estimated plan period end from last completed subscription payment (ISO). */
  planEndsAt: string | null;
  /** User scheduled cancel — access remains until planEndsAt. */
  cancelAtPeriodEnd?: boolean;
  /** How the current plan period was paid. */
  billingChannel: "crypto" | "card" | "unknown" | null;
  billingInterval: "monthly" | "annual" | string | null;
  usage: {
    last24h: number;
    last1w: number;
    last1m: number;
  };
};

/** JSON cannot encode Infinity — API/clients may send null for unlimited. */
export function normalizeUserStats(data: UserStats): UserStats {
  const quota =
    data.quota == null || !Number.isFinite(Number(data.quota))
      ? Infinity
      : Number(data.quota);

  return {
    ...data,
    quota,
    balance: Number(data.balance) || 0,
    intelxUsedToday: Number(data.intelxUsedToday) || 0,
    usage: {
      last24h: Number(data.usage?.last24h) || 0,
      last1w: Number(data.usage?.last1w) || 0,
      last1m: Number(data.usage?.last1m) || 0,
    },
  };
}

export function isUnlimitedSearchQuota(quota: number | null | undefined) {
  return quota == null || !Number.isFinite(Number(quota));
}

export function getUserPlan(user: UserProfile | null): PlanId {
  if (!user) return "free";

  return resolveUserPlan(user);
}

export function getPlanDisplayLabel(user: UserProfile | null) {
  return getPlanLabel(getUserPlan(user));
}

export function formatAvailableSearches(stats: UserStats | null) {
  if (!stats) return "—";

  if (isUnlimitedSearchQuota(stats.quota)) return "∞";

  return String(Math.max(stats.quota - stats.usage.last24h, 0));
}

/** Remaining / plan daily quota, e.g. `12 / 50` or `∞`. */
export function formatSearchQuota(stats: UserStats | null) {
  if (!stats) return null;

  if (isUnlimitedSearchQuota(stats.quota)) return "∞";

  const remaining = Math.max(stats.quota - stats.usage.last24h, 0);

  return `${remaining} / ${stats.quota}`;
}

/** Compact label for chips / sidebar: `12 / 50 searches` or `∞ searches`. */
export function formatSearchQuotaLabel(stats: UserStats | null) {
  const quota = formatSearchQuota(stats);

  if (!quota) return null;

  return isUnlimitedSearchQuota(stats?.quota) ? "∞ searches" : `${quota} searches`;
}

export function searchQuotaTitle(stats: UserStats | null) {
  if (!stats) return "Daily search quota";

  if (isUnlimitedSearchQuota(stats.quota)) {
    return "Unlimited searches on your plan";
  }

  const remaining = Math.max(stats.quota - stats.usage.last24h, 0);
  const used = stats.usage.last24h;

  return `${remaining} of ${stats.quota} daily searches left (${used} used in last 24h)`;
}

/** Display User.balance as USD. */
export function formatBalance(balance: number | undefined) {
  if (balance === undefined) return "$0.00";

  return `$${balance.toFixed(2)}`;
}

/**
 * Display User.balance as credits (1 credit ≈ $1).
 * Whole amounts drop trailing zeros; fractional keep two decimals.
 */
export function formatCredits(balance: number | undefined) {
  const value = balance ?? 0;

  if (!Number.isFinite(value)) return "0";

  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }

  return value.toFixed(2);
}

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
