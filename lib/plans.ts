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

/**
 * Features that burn residential proxy bandwidth.
 * Charged for every plan (including Ultimate/Enterprise) because egress is a real cost.
 * - email-presence-deep: Contact Profiles optional deep probe set
 * - instagram-live: Instagram session/graph search (/api/osint/instagram)
 * - hinge-live: entire Hinge Live module
 */
export const RESIDENTIAL_PROXY_MODULE_SLUGS = new Set([
  "email-presence-deep",
  "instagram-live",
  "hinge-live",
  "tinder-live",
]);
/** Credits charged per residential-proxy search (1 credit ≈ $1). */
export const RESIDENTIAL_PROXY_CREDIT_COST = 1;

/**
 * Spend credits to unlock a teaser-vaulted search (guest/free/starter soft-lock).
 * Does not unlock Class P seat modules (AI / public records).
 */
export const SEARCH_UNLOCK_MODULE_SLUG = "search-unlock";
export const SEARCH_UNLOCK_CREDIT_COST = 1;

/** Module access classes for paygate / homepage unlock UX. */
export type ModuleAccessClass = "S" | "I" | "C" | "P";

/** Class S — starter / homepage open set. */
export const MODULE_CLASS_S = new Set([
  ...STARTER_MODULE_SLUGS,
  "email-analyze",
]);

/** Class C — real $/query burn (proxy, stealer PPU, intelx quota billing aliases). */
export const MODULE_CLASS_C = new Set([
  ...RESIDENTIAL_PROXY_MODULE_SLUGS,
  "stealer-logs",
  "intelx",
]);

/**
 * Homepage Class C premium picker (credit-costing tools runnable from home).
 * Cost is resolved via checkModuleAccess / RESIDENTIAL_PROXY / PAY_PER_USE.
 */
export const HOME_PREMIUM_MODULE_OPTIONS = [
  {
    id: "stealer-logs",
    label: "Stealer Logs",
    billingSlug: "stealer-logs",
    hint: "0.25 credits on Professional · included on Ultimate+",
  },
  {
    id: "instagram-live",
    label: "Instagram Live",
    billingSlug: "instagram-live",
    hint: "1 credit",
  },
  {
    id: "hinge-live",
    label: "Hinge Live",
    billingSlug: "hinge-live",
    hint: "1 credit",
  },
] as const;

/**
 * Billing slug for authorize/stats when a search burns residential proxy.
 * Contact Profiles deep, Instagram Live tool, and Hinge Live module.
 */
export function resolveResidentialProxyBillingSlug(input: {
  moduleSlug: string;
  selectedToolId?: string | null;
  contactProfilesDeep?: boolean;
}): string | null {
  const { moduleSlug, selectedToolId, contactProfilesDeep } = input;

  if (moduleSlug === "hinge-live" || moduleSlug === "tinder-live") {
    return moduleSlug;
  }

  if (moduleSlug === "instagram") {
    if (!selectedToolId || selectedToolId === "instagram-live") {
      return "instagram-live";
    }

    return null;
  }

  if (selectedToolId === "instagram-live") return "instagram-live";

  if (
    contactProfilesDeep &&
    (moduleSlug === "email-presence" || selectedToolId === "email-presence")
  ) {
    return "email-presence-deep";
  }

  return null;
}

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

/**
 * Ultimate / Enterprise exclusives — Professional and below see sidebar lock + API 403.
 * BreachHub-billed OathNet enrichment inside other modules may still run when BH is keyed;
 * the dedicated OathNet module and `/api/oathnet/*` require Ultimate+.
 */
export const ULTIMATE_MODULE_SLUGS = new Set(["oathnet"]);

const ULTIMATE_MODULE_DENY_REASON =
  "OathNet requires Ultimate or Enterprise.";

export function planHasUltimateModules(plan: PlanId): boolean {
  return plan === "ultimate" || plan === "enterprise";
}

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

/** Class P — plan seat premium (credits alone cannot unlock). */
export const MODULE_CLASS_P = new Set([
  ...AI_MODULE_SLUGS,
  ...PUBLIC_RECORDS_MODULE_SLUGS,
  ...ULTIMATE_MODULE_SLUGS,
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
  "name-search",
]);

export function getModuleAccessClass(moduleSlug: string): ModuleAccessClass {
  if (MODULE_CLASS_S.has(moduleSlug)) return "S";
  if (MODULE_CLASS_C.has(moduleSlug)) return "C";
  if (MODULE_CLASS_P.has(moduleSlug)) return "P";

  return "I";
}

/** Minimum paid plan that sees Class S results clear (not teaser). */
export function planClearsStarterTeaser(plan: PlanId): boolean {
  return plan !== "free";
}

/** Professional+ panel sees Class I clear without credit unlock. */
export function planClearsIncludedModules(plan: PlanId): boolean {
  return (
    plan === "professional" ||
    plan === "ultimate" ||
    plan === "enterprise"
  );
}

export function planMeetsModuleClass(
  plan: PlanId,
  accessClass: ModuleAccessClass,
): boolean {
  if (accessClass === "S") return planClearsStarterTeaser(plan);
  if (accessClass === "I") return planClearsIncludedModules(plan);
  if (accessClass === "P") return planClearsIncludedModules(plan);

  // Class C still needs credits/quota — plan only opens Professional+ panel.
  return planClearsIncludedModules(plan);
}

/** Whether credits can unlock a vaulted teaser for this module class. */
export function creditsCanUnlockModuleClass(
  accessClass: ModuleAccessClass,
): boolean {
  // Class P seat modules require a plan — credits alone are not enough.
  return accessClass === "S" || accessClass === "I";
}

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
      "All other panel modules except unrestricted AI and OathNet",
      "Restricted AI Intelligence",
      "5 IntelX searches per day included",
      "OathNet requires Ultimate or Enterprise",
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
      "OathNet specialty module included",
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
      "OathNet specialty module included",
      "All Professional modules included",
      "Priority feature requests",
    ],
  },
];

export type CreditPack = {
  id: string;
  name: string;
  /** Credits included before pack discount/bonus. */
  credits: number;
  /** USD charged (list is $1/credit before discount). */
  price: number;
  /**
   * Bulk discount vs $1/credit list rate (15–25%).
   * Delivered as bonus credits: pay `price`, receive price + discount%.
   */
  discountPercent: number;
  description: string;
  highlighted?: boolean;
};

/** List rate for à-la-carte / custom top-ups. */
export const CREDIT_UNIT_USD = 1;

export const CUSTOM_CREDIT_MIN = 3;
export const CUSTOM_CREDIT_MAX = 500;
export const CUSTOM_CREDIT_PACK_ID = "credits_custom";

/**
 * Four bulk packs + custom ($1/credit) on the pricing page.
 * Packs price at ~$1/credit face value, then add 15–30% bonus credits —
 * bulk buyers get a better effective rate because unused balance is expected.
 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "credits_25",
    name: "Starter Pack",
    credits: 25,
    price: 25,
    discountPercent: 15,
    description: "15% bulk bonus — light pay-per-use top-ups",
  },
  {
    id: "credits_50",
    name: "Plus Pack",
    credits: 50,
    price: 50,
    discountPercent: 20,
    description: "20% bulk bonus — regular casework volume",
  },
  {
    id: "credits_100",
    name: "Agency Pack",
    credits: 100,
    price: 100,
    discountPercent: 25,
    description: "25% bulk bonus — teams and heavy usage",
  },
  {
    id: "credits_200",
    name: "Scale Pack",
    credits: 200,
    price: 200,
    discountPercent: 30,
    description: "30% bulk bonus — high-volume ops",
  },
];

/** Bonus credits from pack discount (rounded). */
export function getCreditPackBonus(pack: CreditPack): number {
  return Math.round((pack.credits * pack.discountPercent) / 100);
}

export function getCreditPackTotal(pack: CreditPack): number {
  return pack.credits + getCreditPackBonus(pack);
}

/** Effective USD per credit after pack bonus. */
export function getCreditPackUnitPrice(pack: CreditPack): number {
  const total = getCreditPackTotal(pack);

  return total > 0 ? pack.price / total : CREDIT_UNIT_USD;
}

export function clampCustomCredits(raw: number): number {
  if (!Number.isFinite(raw)) return CUSTOM_CREDIT_MIN;

  return Math.min(
    CUSTOM_CREDIT_MAX,
    Math.max(CUSTOM_CREDIT_MIN, Math.round(raw)),
  );
}

export function customCreditsPrice(credits: number): number {
  return clampCustomCredits(credits) * CREDIT_UNIT_USD;
}

/** Recover pack id from payment description prefixes (webhooks / confirm). */
export const CREDIT_PACK_NAME_IDS: Record<string, string> = {
  "Starter Pack": "credits_25",
  "Plus Pack": "credits_50",
  "Agency Pack": "credits_100",
  "Scale Pack": "credits_200",
  "Custom credits": CUSTOM_CREDIT_PACK_ID,
  // Legacy names still in pending rows
  "Investigator Pack": "credits_25",
  "Ops Pack": "credits_50",
};

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

function checkResidentialProxyAccess(
  moduleSlug: string,
  balance: number,
): SearchAccessResult | null {
  if (!RESIDENTIAL_PROXY_MODULE_SLUGS.has(moduleSlug)) return null;

  const label =
    moduleSlug === "email-presence-deep"
      ? "Contact Profiles deep search"
      : moduleSlug === "instagram-live"
        ? "Instagram Live"
        : moduleSlug === "hinge-live"
          ? "Hinge Live"
          : moduleSlug === "tinder-live"
            ? "Tinder Live"
            : "This search";

  if (balance < RESIDENTIAL_PROXY_CREDIT_COST) {
    return {
      allowed: false,
      reason: `${label} costs ${RESIDENTIAL_PROXY_CREDIT_COST} credit per search. Top up on the Pricing page.`,
      requiresBalance: true,
      balanceCost: RESIDENTIAL_PROXY_CREDIT_COST,
    };
  }

  return {
    allowed: true,
    requiresBalance: true,
    balanceCost: RESIDENTIAL_PROXY_CREDIT_COST,
  };
}

export function checkModuleAccess(
  plan: PlanId,
  moduleSlug: string,
  options?: { balance?: number; intelxUsedToday?: number },
): SearchAccessResult {
  const balance = options?.balance ?? 0;
  const intelxUsedToday = options?.intelxUsedToday ?? 0;

  // Residential proxy billing applies to all paid panel plans (incl. Ultimate).
  const proxyGate = checkResidentialProxyAccess(moduleSlug, balance);

  if (ULTIMATE_MODULE_SLUGS.has(moduleSlug) && !planHasUltimateModules(plan)) {
    return {
      allowed: false,
      reason: ULTIMATE_MODULE_DENY_REASON,
    };
  }

  if (moduleSlug === SEARCH_UNLOCK_MODULE_SLUG) {
    if (plan === "free" || plan === "starter" || planClearsIncludedModules(plan)) {
      if (balance < SEARCH_UNLOCK_CREDIT_COST) {
        return {
          allowed: false,
          reason: `Unlocking this search costs ${SEARCH_UNLOCK_CREDIT_COST} credit. Top up on the Pricing page.`,
          requiresBalance: true,
          balanceCost: SEARCH_UNLOCK_CREDIT_COST,
        };
      }

      return {
        allowed: true,
        requiresBalance: true,
        balanceCost: SEARCH_UNLOCK_CREDIT_COST,
      };
    }

    return {
      allowed: false,
      reason: "Sign in to unlock this search.",
    };
  }

  if (proxyGate && (plan === "free" || plan === "starter")) {
    return {
      allowed: false,
      reason:
        "These tools require Professional or higher (and 1 credit per search).",
      requiresBalance: true,
      balanceCost: RESIDENTIAL_PROXY_CREDIT_COST,
    };
  }

  if (plan === "enterprise" || plan === "ultimate") {
    if (proxyGate) return proxyGate;

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

  if (proxyGate) return proxyGate;

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
        { label: "OathNet", value: "Ultimate+" },
        { label: "IntelX included", value: "5 / day" },
        { label: "AI access", value: "Restricted" },
      ];
    case "ultimate":
      return [
        { label: "Daily searches", value: searches, accent: true },
        { label: "Dashboard", value: "Full" },
        { label: "AI access", value: "Full" },
        { label: "OathNet", value: "Included", accent: true },
        { label: "Modules", value: "All included", accent: true },
      ];
    case "enterprise":
      return [
        { label: "Daily searches", value: searches, accent: true },
        { label: "Support", value: "Dedicated SLA" },
        { label: "Seats", value: "Team onboarding" },
        { label: "OathNet", value: "Included", accent: true },
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
