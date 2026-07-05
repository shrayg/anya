export type PlanId =
  | "free"
  | "starter"
  | "basic"
  | "professional"
  | "advanced"
  | "enterprise";

export const PLAN_IDS: PlanId[] = [
  "free",
  "starter",
  "basic",
  "professional",
  "advanced",
  "enterprise",
];

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  basic: 2,
  professional: 3,
  advanced: 4,
  enterprise: 5,
};

export const RELEASE_SALE = true;

export const FREE_MODULE_SLUGS = new Set([
  "phone",
  "username",
  "discord-id",
  "roblox",
  "minecraft",
  "steam",
  "github",
]);

export const AI_MODULE_SLUGS = new Set([
  "ai-search",
  "ai-deep-scan",
  "crypto-ai",
  "threat-brief",
]);

export const PAY_PER_USE_MODULE_SLUGS = new Set(["intelx", "stealer-logs"]);
export const PAY_PER_USE_COST = 0.25;
export const PROFESSIONAL_INTELX_DAILY_LIMIT = 5;

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number | null;
  saleMonthlyPrice?: number;
  dailySearchLimit: number;
  features: string[];
  highlighted?: boolean;
  customPricing?: boolean;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with core identity and platform lookups",
    monthlyPrice: 0,
    dailySearchLimit: 5,
    features: [
      "5 searches per day",
      "Phone, Email, Username",
      "Discord ID, Roblox, Minecraft, Steam, GitHub",
      "Results blurred until you upgrade",
      "IntelX not available",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "More searches and full module access",
    monthlyPrice: 4.99,
    dailySearchLimit: 15,
    features: [
      "15 searches per day",
      "All modules except AI Intelligence",
      "IntelX & Stealer Logs: $0.25 per search (balance)",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    description: "Higher daily limits for active investigators",
    monthlyPrice: 14.99,
    saleMonthlyPrice: 10.5,
    dailySearchLimit: 50,
    features: [
      "50 searches per day",
      "All modules except AI Intelligence",
      "IntelX & Stealer Logs: $0.25 per search (balance)",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Unlimited searches with restricted AI access",
    monthlyPrice: 49.99,
    saleMonthlyPrice: 29.99,
    dailySearchLimit: Infinity,
    highlighted: true,
    features: [
      "Unlimited searches",
      "All modules + restricted AI Intelligence",
      "5 IntelX searches per day included",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    description: "Full unrestricted access to everything",
    monthlyPrice: 69.99,
    saleMonthlyPrice: 41.99,
    dailySearchLimit: Infinity,
    features: [
      "Unlimited searches",
      "Full AI Intelligence access",
      "IntelX & Stealer Logs included",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom deployments for teams and agencies",
    monthlyPrice: null,
    dailySearchLimit: Infinity,
    customPricing: true,
    features: [
      "Custom search limits",
      "Dedicated support & SLA",
      "API access on request",
      "Tailored onboarding",
    ],
  },
];

export type UserPlanRecord = {
  plan?: string | null;
  balance?: number | null;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
};

export function isPlanId(value: string | null | undefined): value is PlanId {
  return Boolean(value && PLAN_IDS.includes(value as PlanId));
}

export function resolveUserPlan(user: UserPlanRecord): PlanId {
  const candidates: PlanId[] = ["free"];

  if (user.plan && isPlanId(user.plan)) {
    candidates.push(user.plan);
  }
  if (user.enterpriseTier) candidates.push("enterprise");
  if (user.investigatorTier) candidates.push("advanced");
  if (user.professionalTier) candidates.push("professional");

  return candidates.reduce((best, current) =>
    PLAN_RANK[current] > PLAN_RANK[best] ? current : best,
  );
}

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  return PLAN_DEFINITIONS.find((entry) => entry.id === plan) ?? PLAN_DEFINITIONS[0];
}

export function getPlanLabel(plan: PlanId): string {
  return getPlanDefinition(plan).name.toLowerCase();
}

export function getDailySearchQuota(plan: PlanId): number {
  return getPlanDefinition(plan).dailySearchLimit;
}

export function shouldBlurResults(plan: PlanId): boolean {
  return plan === "free";
}

export function hasUnrestrictedAi(plan: PlanId): boolean {
  return plan === "advanced" || plan === "enterprise";
}

export function hasRestrictedAi(plan: PlanId): boolean {
  return plan === "professional" || hasUnrestrictedAi(plan);
}

export type SearchAccessResult = {
  allowed: boolean;
  reason?: string;
  blurResults?: boolean;
  requiresBalance?: boolean;
  balanceCost?: number;
  usesIntelxQuota?: boolean;
};

export function checkModuleAccess(
  plan: PlanId,
  moduleSlug: string,
  options?: { balance?: number; intelxUsedToday?: number },
): SearchAccessResult {
  const balance = options?.balance ?? 0;
  const intelxUsedToday = options?.intelxUsedToday ?? 0;

  if (plan === "enterprise" || plan === "advanced") {
    return { allowed: true };
  }

  if (AI_MODULE_SLUGS.has(moduleSlug)) {
    if (hasRestrictedAi(plan)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "AI Intelligence requires Professional or higher.",
    };
  }

  if (plan === "free") {
    if (FREE_MODULE_SLUGS.has(moduleSlug)) {
      return { allowed: true, blurResults: true };
    }

    if (moduleSlug === "intelx") {
      return {
        allowed: false,
        reason: "IntelX is not available on the Free plan. Upgrade to Starter or higher.",
      };
    }

    return {
      allowed: false,
      reason: "Upgrade to Starter to unlock this module.",
    };
  }

  if (PAY_PER_USE_MODULE_SLUGS.has(moduleSlug)) {
    if (plan === "starter" || plan === "basic") {
      if (balance < PAY_PER_USE_COST) {
        return {
          allowed: false,
          reason: `IntelX and Stealer Logs cost $${PAY_PER_USE_COST.toFixed(2)} per search. Top up your balance in Settings.`,
          requiresBalance: true,
          balanceCost: PAY_PER_USE_COST,
        };
      }

      return {
        allowed: true,
        requiresBalance: true,
        balanceCost: PAY_PER_USE_COST,
      };
    }

    if (plan === "professional" && moduleSlug === "intelx") {
      if (intelxUsedToday >= PROFESSIONAL_INTELX_DAILY_LIMIT) {
        return {
          allowed: false,
          reason: `Professional includes ${PROFESSIONAL_INTELX_DAILY_LIMIT} IntelX searches per day. Resets in 24h.`,
          usesIntelxQuota: true,
        };
      }

      return { allowed: true, usesIntelxQuota: true };
    }
  }

  return { allowed: true };
}

export function checkDailySearchQuota(
  plan: PlanId,
  searchesLast24h: number,
): SearchAccessResult {
  const quota = getDailySearchQuota(plan);

  if (quota === Infinity) {
    return { allowed: true };
  }

  if (searchesLast24h >= quota) {
    return {
      allowed: false,
      reason: `Daily limit reached (${quota} searches). Upgrade your plan for more.`,
    };
  }

  return { allowed: true };
}

export function planUpdatesFromId(plan: PlanId) {
  return {
    plan,
    subscripted: plan !== "free",
    freeTier: plan === "free",
    professionalTier: plan === "professional",
    investigatorTier: plan === "advanced",
    enterpriseTier: plan === "enterprise",
  };
}

export function getDisplayPrice(plan: PlanDefinition, useSale = RELEASE_SALE) {
  if (plan.customPricing || plan.monthlyPrice === null) {
    return { label: "Custom", value: null as number | null, sale: false };
  }

  if (useSale && plan.saleMonthlyPrice !== undefined) {
    return {
      label: plan.saleMonthlyPrice.toFixed(2),
      value: plan.saleMonthlyPrice,
      original: plan.monthlyPrice,
      sale: true,
    };
  }

  return {
    label: plan.monthlyPrice.toFixed(2),
    value: plan.monthlyPrice,
    sale: false,
  };
}
