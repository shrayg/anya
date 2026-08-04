export type PlanId =
  | "free"
  | "starter"
  | "professional"
  | "ultimate"
  | "enterprise";

/** Legacy plan strings still present in the DB — normalized by resolveUserPlan. */
type LegacyPlanId = "basic" | "advanced";

export type BillingInterval = "monthly" | "annual";

export const PLAN_IDS: PlanId[] = [
  "free",
  "starter",
  "professional",
  "ultimate",
  "enterprise",
];

/** Plans shown on the public pricing page (excludes free). */
export const PRICING_PLAN_IDS: PlanId[] = [
  "starter",
  "professional",
  "ultimate",
  "enterprise",
];

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  ultimate: 3,
  enterprise: 4,
};

/** Annual billing = 9× monthly (3 months free). Checkout (Square/OxaPay) uses this. */
export const ANNUAL_MONTHS_CHARGED = 9;
export const ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_CHARGED;

export const FREE_MODULE_SLUGS = new Set([
  "breaches",
  "phone",
  "username",
  "discord-id",
  "roblox",
  "minecraft",
  "steam",
  "github",
]);

/** Starter homepage: Email, Phone, Username, Discord, Breaches. */
export const STARTER_MODULE_SLUGS = new Set([
  "breaches",
  "phone",
  "username",
  "discord-id",
]);

export const AI_MODULE_SLUGS = new Set([
  "ai-search",
  "ai-deep-scan",
  "crypto-ai",
  "threat-brief",
]);

export const PAY_PER_USE_MODULE_SLUGS = new Set(["intelx", "stealer-logs"]);
/** USD charged per pay-per-use search (module rates may change; balance is credit-denominated). */
export const PAY_PER_USE_COST = 0.25;
export const PROFESSIONAL_INTELX_DAILY_LIMIT = 5;

/** Account balance unit: 1 credit ≈ $1 USD. Pack prices mirror credit counts. */
export const CREDIT_USD_VALUE = 1;

/**
 * Premium investigation modules — Free/Starter see sidebar lock; Professional+ can use.
 * IntelX / Stealer Logs are also in PAY_PER_USE_MODULE_SLUGS (Pro quota / credits).
 * Legacy crypto-* slugs fold into Crypto Intel for API gating without moduleSlug.
 */
export const PROFESSIONAL_MODULE_SLUGS = new Set([
  "intelx",
  "stealer-logs",
  "crypto-intel",
  "crypto-wallet",
  "crypto-address",
  "crypto-tx",
  "crypto-risk",
  "crypto-flow",
  "passport",
  "notalivex-country",
  "notalivex-platform",
  "notalivex-renaper",
  "google-docs",
  "ganknow",
  "fivem",
  "seekria-fivem",
]);

const PROFESSIONAL_MODULE_DENY_REASON =
  "IntelX, Stealer Logs, Crypto Intel, Passport, LATAM Country DB, NotAliveX Social, AR Renaper, Google Docs Intel, Ganknow, and FiveM require Professional or higher.";

/** Public-records modules require Professional panel access (not Free/Starter homepage set). */
export const PUBLIC_RECORDS_MODULE_SLUGS = new Set([
  "public-records",
  "court-records",
  "identity-search",
  "npd-search",
  "va-sex-offender",
  "global-public-records",
  "sanctions-watchlists",
  "wanted-persons",
  "national-sor",
  "state-records-directory",
  "international-records-directory",
  "portal-backlog",
]);

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number | null;
  /** Pre-sale list price shown struck through when set (e.g. Professional Sale). */
  compareAtMonthlyPrice?: number;
  /** Sale badge label, e.g. "Sale" or "Discount". */
  saleBadge?: string;
  dailySearchLimit: number;
  features: string[];
  highlighted?: boolean;
  customPricing?: boolean;
  /** Starter has homepage search only — no /dashboard panel. */
  panelAccess: boolean;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Limited homepage lookups while you evaluate the platform",
    monthlyPrice: 0,
    dailySearchLimit: 5,
    panelAccess: false,
    features: [
      "5 searches per day",
      "Core homepage lookups",
      "Results blurred until you upgrade",
      "No dashboard / panel access",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "Core identity lookups — email, phone, username, and Discord",
    monthlyPrice: 14.99,
    dailySearchLimit: 150,
    panelAccess: false,
    features: [
      "150 searches per day",
      "Email, Phone, Username, Discord ID",
      "Linked accounts, aliases, breach exposure, profile photos",
      "No dashboard / panel access",
      "Upgrade to Professional for IntelX, Stealer Logs, Crypto Intel, LATAM tools & the full panel",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Full panel access for active investigators",
    monthlyPrice: 39.99,
    dailySearchLimit: 500,
    panelAccess: true,
    highlighted: true,
    features: [
      "500 searches per day",
      "Full dashboard / panel access",
      "Professional modules: IntelX, Stealer Logs, Crypto Intel, Passport, LATAM Country DB, NotAliveX Social, AR Renaper, Google Docs Intel, Ganknow & FiveM",
      "All other panel modules except unrestricted AI",
      "Restricted AI Intelligence",
      "5 IntelX searches per day included",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "Unlimited searches with full AI access",
    monthlyPrice: 79.99,
    dailySearchLimit: Infinity,
    panelAccess: true,
    features: [
      "Unlimited searches",
      "Full dashboard / panel access",
      "Full AI Intelligence access",
      "IntelX & Stealer Logs included",
      "All Professional modules (Crypto Intel, Passport, LATAM / NotAliveX, Google Docs Intel, Ganknow, FiveM)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Team and agency deployments with dedicated support",
    monthlyPrice: null,
    customPricing: true,
    dailySearchLimit: Infinity,
    panelAccess: true,
    features: [
      "Unlimited searches",
      "Dedicated support & SLA",
      "Team seats & onboarding",
      "All Professional modules included",
      "Priority feature requests",
    ],
  },
];

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonusCredits?: number;
  description: string;
  highlighted?: boolean;
};

/** Credit packs top up User.balance (1 credit ≈ $1) for pay-per-use modules. */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "credits_10",
    name: "Starter Pack",
    credits: 10,
    price: 10,
    description: "10 credits — enough to try pay-per-use modules",
  },
  {
    id: "credits_25",
    name: "Investigator Pack",
    credits: 25,
    price: 25,
    bonusCredits: 3,
    description: "25 credits + 3 bonus — best for regular casework",
    highlighted: true,
  },
  {
    id: "credits_50",
    name: "Ops Pack",
    credits: 50,
    price: 50,
    bonusCredits: 8,
    description: "50 credits + 8 bonus — higher-volume investigations",
  },
  {
    id: "credits_100",
    name: "Agency Pack",
    credits: 100,
    price: 100,
    bonusCredits: 20,
    description: "100 credits + 20 bonus — teams and heavy usage",
  },
];

export type ApiProduct = {
  id: "api_access";
  name: string;
  description: string;
  monthlyPrice: number;
  features: string[];
};

export const API_PRODUCT: ApiProduct = {
  id: "api_access",
  name: "API Access",
  description: "Programmatic access to Anya intelligence endpoints",
  monthlyPrice: 249.99,
  features: [
    "REST API for OSINT modules",
    "API key authentication",
    "Higher rate limits",
    "Usage analytics",
    "Email support",
  ],
};

export type UserPlanRecord = {
  plan?: string | null;
  balance?: number | null;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
  apiAccess?: boolean | null;
  billingInterval?: string | null;
};

export function normalizePlanId(
  value: string | null | undefined,
): PlanId | null {
  if (!value) return null;
  if (PLAN_IDS.includes(value as PlanId)) return value as PlanId;

  const legacy: Record<LegacyPlanId, PlanId> = {
    basic: "professional",
    advanced: "ultimate",
  };

  if (value in legacy) return legacy[value as LegacyPlanId];

  return null;
}

export function isPlanId(value: string | null | undefined): value is PlanId {
  return Boolean(value && PLAN_IDS.includes(value as PlanId));
}

export function resolveUserPlan(user: UserPlanRecord): PlanId {
  const candidates: PlanId[] = ["free"];

  const normalized = normalizePlanId(user.plan ?? null);

  if (normalized) candidates.push(normalized);
  else if (user.plan && isPlanId(user.plan)) candidates.push(user.plan);

  if (user.enterpriseTier) candidates.push("enterprise");
  if (user.investigatorTier) candidates.push("ultimate");
  if (user.professionalTier) candidates.push("professional");

  return candidates.reduce((best, current) =>
    PLAN_RANK[current] > PLAN_RANK[best] ? current : best,
  );
}

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  return (
    PLAN_DEFINITIONS.find((entry) => entry.id === plan) ?? PLAN_DEFINITIONS[0]
  );
}

export function getPricingPlans(): PlanDefinition[] {
  return PLAN_DEFINITIONS.filter((plan) => PRICING_PLAN_IDS.includes(plan.id));
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
  return plan === "ultimate" || plan === "enterprise";
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

  if (plan === "enterprise" || plan === "ultimate") {
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
    if (FREE_MODULE_SLUGS.has(moduleSlug) || STARTER_MODULE_SLUGS.has(moduleSlug)) {
      return { allowed: true, blurResults: true };
    }

    if (PUBLIC_RECORDS_MODULE_SLUGS.has(moduleSlug)) {
      return {
        allowed: false,
        reason:
          "US public records tools require Professional or higher for full panel access.",
      };
    }

    if (PROFESSIONAL_MODULE_SLUGS.has(moduleSlug)) {
      return {
        allowed: false,
        reason: PROFESSIONAL_MODULE_DENY_REASON,
      };
    }

    return {
      allowed: false,
      reason:
        "Upgrade to Starter for email/phone identity search, or Professional for the full panel.",
    };
  }

  if (plan === "starter") {
    if (STARTER_MODULE_SLUGS.has(moduleSlug)) {
      return { allowed: true };
    }

    if (PUBLIC_RECORDS_MODULE_SLUGS.has(moduleSlug)) {
      return {
        allowed: false,
        reason:
          "US public records tools require Professional or higher for full panel access.",
      };
    }

    if (PROFESSIONAL_MODULE_SLUGS.has(moduleSlug)) {
      return {
        allowed: false,
        reason: PROFESSIONAL_MODULE_DENY_REASON,
      };
    }

    return {
      allowed: false,
      reason:
        "Starter includes Email, Phone, Username, and Discord only. Upgrade to Professional for the full panel.",
    };
  }

  if (PAY_PER_USE_MODULE_SLUGS.has(moduleSlug)) {
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

    if (plan === "professional" && moduleSlug === "stealer-logs") {
      if (balance < PAY_PER_USE_COST) {
        return {
          allowed: false,
          reason: `Stealer Logs costs ${PAY_PER_USE_COST} credits per search. Top up on the Pricing page.`,
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
    investigatorTier: plan === "ultimate",
    enterpriseTier: plan === "enterprise",
  };
}

/** Label/value rows for pricing cards (mirrors credit-pack ledger). */
export function getPlanLedgerRows(
  plan: PlanDefinition,
): { label: string; value: string; accent?: boolean }[] {
  const searches =
    plan.dailySearchLimit === Infinity
      ? "Unlimited"
      : String(plan.dailySearchLimit);

  switch (plan.id) {
    case "starter":
      return [
        { label: "Daily searches", value: searches },
        { label: "Dashboard", value: "No" },
        { label: "Lookups", value: "Core identity" },
        { label: "Pro modules", value: "—" },
      ];
    case "professional":
      return [
        { label: "Daily searches", value: searches },
        { label: "Dashboard", value: "Full" },
        { label: "Modules", value: "Professional" },
        { label: "IntelX included", value: "5 / day" },
        { label: "AI access", value: "Restricted" },
      ];
    case "ultimate":
      return [
        { label: "Daily searches", value: searches, accent: true },
        { label: "Dashboard", value: "Full" },
        { label: "AI access", value: "Full" },
        { label: "Modules", value: "All included", accent: true },
      ];
    case "enterprise":
      return [
        { label: "Daily searches", value: searches, accent: true },
        { label: "Support", value: "Dedicated SLA" },
        { label: "Seats", value: "Team onboarding" },
        { label: "Modules", value: "All included", accent: true },
      ];
    default:
      return plan.features.map((feature) => ({
        label: feature,
        value: "Included",
      }));
  }
}

export function getPlanQuotaSummary(plan: PlanDefinition): string {
  if (plan.dailySearchLimit === Infinity) return "Unlimited searches";

  return `${plan.dailySearchLimit} searches / day`;
}

export function getPlanPrice(
  plan: PlanDefinition,
  interval: BillingInterval = "monthly",
): { label: string; value: number | null; monthlyEquivalent: number | null } {
  if (plan.customPricing || plan.monthlyPrice === null) {
    return { label: "Custom", value: null, monthlyEquivalent: null };
  }

  if (interval === "annual") {
    const annual = Number(
      (plan.monthlyPrice * ANNUAL_MONTHS_CHARGED).toFixed(2),
    );

    return {
      label: annual.toFixed(2),
      value: annual,
      monthlyEquivalent: Number((annual / 12).toFixed(2)),
    };
  }

  return {
    label: plan.monthlyPrice.toFixed(2),
    value: plan.monthlyPrice,
    monthlyEquivalent: plan.monthlyPrice,
  };
}

/** @deprecated Use getPlanPrice — kept for staff payment recording. */
export function getDisplayPrice(plan: PlanDefinition) {
  const price = getPlanPrice(plan, "monthly");
  const onSale =
    plan.compareAtMonthlyPrice != null &&
    price.value != null &&
    plan.compareAtMonthlyPrice > price.value;

  return {
    label: price.label,
    value: price.value,
    sale: onSale,
    compareAt: onSale ? plan.compareAtMonthlyPrice : null,
    saleBadge: onSale ? (plan.saleBadge ?? "Sale") : null,
  };
}

/** Compare-at (list) price for the selected billing interval, when on sale. */
export function getCompareAtPrice(
  plan: PlanDefinition,
  interval: BillingInterval = "monthly",
): number | null {
  if (
    plan.compareAtMonthlyPrice == null ||
    plan.monthlyPrice == null ||
    plan.compareAtMonthlyPrice <= plan.monthlyPrice
  ) {
    return null;
  }

  if (interval === "annual") {
    return Number(
      (plan.compareAtMonthlyPrice * ANNUAL_MONTHS_CHARGED).toFixed(2),
    );
  }

  return plan.compareAtMonthlyPrice;
}

export function getApiPrice(interval: BillingInterval = "monthly"): {
  label: string;
  value: number;
  monthlyEquivalent: number;
} {
  if (interval === "annual") {
    const annual = Number(
      (API_PRODUCT.monthlyPrice * ANNUAL_MONTHS_CHARGED).toFixed(2),
    );

    return {
      label: annual.toFixed(2),
      value: annual,
      monthlyEquivalent: Number((annual / 12).toFixed(2)),
    };
  }

  return {
    label: API_PRODUCT.monthlyPrice.toFixed(2),
    value: API_PRODUCT.monthlyPrice,
    monthlyEquivalent: API_PRODUCT.monthlyPrice,
  };
}

export function getCreditPackTotal(pack: CreditPack): number {
  return pack.credits + (pack.bonusCredits ?? 0);
}

export function hasWorkspaceDashboardAccess(
  user: UserPlanRecord & { canManageWorkspace?: boolean },
): boolean {
  if (user.canManageWorkspace) return true;

  const plan = resolveUserPlan(user);

  return getPlanDefinition(plan).panelAccess;
}

export function getAppLandingPath(
  user: UserPlanRecord & { canManageWorkspace?: boolean },
): string {
  return hasWorkspaceDashboardAccess(user)
    ? "/dashboard/search/ai-search"
    : "/#search";
}

export function annualSavingsLabel(monthlyPrice: number): string {
  const saved = monthlyPrice * ANNUAL_MONTHS_FREE;

  return `Save $${saved.toFixed(2)}/yr`;
}
