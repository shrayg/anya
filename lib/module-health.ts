import { probeBreachVip } from "@/lib/breachvip";
import {
  fetchGodsEyeIngressCheck,
  fetchGodsEyeRawExport,
  fetchGodsEyeSearch,
  getGodsEyeApiKey,
  getGodsEyeExportApiKey,
} from "@/lib/godseye";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getOsintCatApiKey } from "@/lib/osintcat";
import { getCourtListenerToken } from "@/lib/us-records/courtlistener";

const OSINTCAT_BASE = "https://www.osintcat.net/api";

export type ProviderId =
  | "osintcat"
  | "godseye"
  | "godseye-export"
  | "breachvip"
  | "builtin"
  | "courtlistener";

export type ModuleHealthRule =
  | { kind: "off" }
  | { kind: "any"; providers: ProviderId[] }
  | { kind: "all"; providers: ProviderId[] };

/** How each module decides green vs red based on provider probes. */
export const MODULE_HEALTH_RULES: Record<string, ModuleHealthRule> = {
  "ai-search": { kind: "any", providers: ["osintcat"] },
  "ai-deep-scan": { kind: "any", providers: ["osintcat"] },
  "crypto-ai": { kind: "any", providers: ["osintcat"] },
  "threat-brief": { kind: "any", providers: ["osintcat"] },
  intelx: { kind: "all", providers: ["godseye-export"] },
  "stealer-logs": { kind: "any", providers: ["osintcat", "godseye"] },
  breaches: { kind: "any", providers: ["builtin", "godseye", "breachvip"] },
  domain: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  "hash-lookup": { kind: "any", providers: ["godseye"] },
  "password-search": { kind: "any", providers: ["godseye", "breachvip"] },
  "name-search": {
    kind: "any",
    providers: ["godseye", "breachvip", "builtin", "courtlistener"],
  },
  phone: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  username: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  ip: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  "crypto-wallet": { kind: "any", providers: ["builtin", "godseye"] },
  "bin-lookup": { kind: "any", providers: ["builtin"] },
  "iban-check": { kind: "any", providers: ["builtin"] },
  "bank-search": { kind: "any", providers: ["builtin", "godseye"] },
  "vin-decoder": { kind: "any", providers: ["builtin"] },
  "car-insurance-us": { kind: "any", providers: ["builtin"] },
  "healthcare-us": { kind: "any", providers: ["builtin"] },
  "court-records": { kind: "any", providers: ["courtlistener"] },
  "identity-search": { kind: "any", providers: ["builtin", "courtlistener"] },
  "npd-search": { kind: "any", providers: ["builtin", "courtlistener"] },
  "discord-id": { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  roblox: { kind: "any", providers: ["osintcat", "godseye"] },
  minecraft: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  steam: { kind: "any", providers: ["osintcat", "godseye", "breachvip"] },
  xbox: { kind: "off" },
  playstation: { kind: "off" },
  telegram: { kind: "any", providers: ["osintcat", "godseye"] },
  instagram: { kind: "any", providers: ["osintcat", "godseye"] },
  snapchat: { kind: "any", providers: ["osintcat", "godseye"] },
  tiktok: { kind: "any", providers: ["osintcat", "godseye"] },
  twitter: { kind: "any", providers: ["osintcat", "godseye"] },
  reddit: { kind: "any", providers: ["osintcat", "godseye"] },
  github: { kind: "any", providers: ["osintcat", "godseye"] },
  fivem: { kind: "any", providers: ["godseye"] },
  tinder: { kind: "any", providers: ["godseye"] },
  bumble: { kind: "any", providers: ["godseye"] },
  hinge: { kind: "any", providers: ["godseye"] },
  match: { kind: "any", providers: ["godseye"] },
  okcupid: { kind: "any", providers: ["godseye"] },
  pof: { kind: "any", providers: ["godseye"] },
  grindr: { kind: "any", providers: ["godseye"] },
  badoo: { kind: "any", providers: ["godseye"] },
};

export type ProviderHealth = Record<ProviderId, boolean>;

async function probeOsintCat(): Promise<boolean> {
  const apiKey = getOsintCatApiKey();
  if (!apiKey) return false;

  try {
    const res = await fetchWithTimeout(
      `${OSINTCAT_BASE}/breach?query=healthcheck%40example.com`,
      {
        headers: { "X-API-KEY": apiKey },
        cache: "no-store",
        timeoutMs: 8_000,
      },
    );

    if (res.status === 401 || res.status === 403) return false;

    return res.ok || res.status === 400 || res.status === 404;
  } catch {
    return false;
  }
}

async function probeGodsEye(): Promise<boolean> {
  const apiKey = getGodsEyeApiKey();
  if (!apiKey) return false;

  const ingress = await fetchGodsEyeIngressCheck();
  if (ingress?.success === true) return true;

  const errorText = String(
    ingress?.error || ingress?.message || "",
  ).toLowerCase();
  if (
    errorText.includes("invalid") ||
    errorText.includes("revoked") ||
    errorText.includes("unauthorized") ||
    errorText.includes("forbidden")
  ) {
    return false;
  }

  try {
    await fetchGodsEyeSearch("roblox", "healthcheck", 8_000);
    return true;
  } catch {
    return false;
  }
}

async function probeGodsEyeExport(): Promise<boolean> {
  if (!getGodsEyeExportApiKey()) return false;

  const { error } = await fetchGodsEyeRawExport("0".repeat(32));
  if (!error) return true;

  const lower = error.toLowerCase();
  if (
    lower.includes("not configured") ||
    lower.includes("invalid") ||
    lower.includes("revoked") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return false;
  }

  return true;
}

async function probeCourtListenerHealth(): Promise<boolean> {
  const token = getCourtListenerToken();
  if (!token) return false;

  try {
    const res = await fetchWithTimeout(
      "https://www.courtlistener.com/api/rest/v4/search/?q=smith&type=o&page_size=1",
      {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        timeoutMs: 8_000,
      },
    );

    if (res.status === 401 || res.status === 403) return false;
    return res.ok || res.status === 400 || res.status === 429;
  } catch {
    return false;
  }
}

export async function probeProviders(): Promise<ProviderHealth> {
  const [osintcat, godseye, godseyeExport, breachvip, courtlistener] =
    await Promise.all([
      probeOsintCat(),
      probeGodsEye(),
      probeGodsEyeExport(),
      probeBreachVip(),
      probeCourtListenerHealth(),
    ]);

  return {
    osintcat,
    godseye,
    "godseye-export": godseyeExport,
    breachvip,
    builtin: true,
    courtlistener,
  };
}

function evaluateRule(rule: ModuleHealthRule, providers: ProviderHealth): boolean {
  if (rule.kind === "off") return false;

  if (rule.kind === "any") {
    return rule.providers.some((provider) => providers[provider]);
  }

  return rule.providers.every((provider) => providers[provider]);
}

export function buildModuleHealthMap(
  providers: ProviderHealth,
): Record<string, boolean> {
  const modules: Record<string, boolean> = {};

  for (const [slug, rule] of Object.entries(MODULE_HEALTH_RULES)) {
    modules[slug] = evaluateRule(rule, providers);
  }

  return modules;
}

export function isModuleOperationalFromMap(
  slug: string,
  modules: Record<string, boolean> | null | undefined,
): boolean {
  if (modules && slug in modules) {
    return modules[slug] ?? false;
  }

  const rule = MODULE_HEALTH_RULES[slug];
  if (!rule) return false;
  if (rule.kind === "off") return false;

  return false;
}
