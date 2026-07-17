import { probeBreachVip } from "@/lib/breachvip";
import { probeCsint } from "@/lib/csint";
import {
  fetchGodsEyeIngressCheck,
  fetchGodsEyeRawExport,
  fetchGodsEyeSearch,
  getGodsEyeApiKey,
  getGodsEyeExportApiKey,
} from "@/lib/godseye";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getOsintCatApiKey } from "@/lib/osintcat";
import { probeInstagramAvailability } from "@/lib/instagram-search";
import { getCourtListenerToken } from "@/lib/us-records/courtlistener";

const OSINTCAT_BASE = "https://www.osintcat.net/api";

export type ProviderId =
  | "osintcat"
  | "godseye"
  | "godseye-export"
  | "breachvip"
  | "csint"
  | "builtin"
  | "courtlistener"
  | "instagram";

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
  "ai-site-pentest": { kind: "any", providers: ["builtin", "csint"] },
  intelx: { kind: "any", providers: ["godseye-export", "csint"] },
  "stealer-logs": { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  breaches: { kind: "any", providers: ["builtin", "godseye", "breachvip", "csint"] },
  domain: { kind: "any", providers: ["osintcat", "godseye", "breachvip", "csint"] },
  "hash-lookup": { kind: "any", providers: ["godseye", "csint"] },
  "password-search": { kind: "any", providers: ["godseye", "breachvip", "csint"] },
  "name-search": {
    kind: "any",
    providers: ["godseye", "breachvip", "builtin", "courtlistener", "csint"],
  },
  "email-analyze": { kind: "any", providers: ["csint"] },
  "fraud-footprint": { kind: "any", providers: ["csint"] },
  breachbase: { kind: "any", providers: ["csint"] },
  "oathnet-roblox": { kind: "any", providers: ["csint"] },
  "contact-enrich": { kind: "any", providers: ["csint"] },
  phone: { kind: "any", providers: ["osintcat", "godseye", "breachvip", "csint"] },
  username: { kind: "any", providers: ["osintcat", "godseye", "breachvip", "csint"] },
  ip: { kind: "any", providers: ["osintcat", "godseye", "breachvip", "csint"] },
  "shodan-host": { kind: "any", providers: ["csint"] },
  "site-pentest": { kind: "any", providers: ["builtin", "csint"] },
  "image-geolocate": { kind: "any", providers: ["csint", "godseye"] },
  "crypto-wallet": { kind: "any", providers: ["builtin", "godseye", "csint"] },
  "bin-lookup": { kind: "any", providers: ["builtin"] },
  "iban-check": { kind: "any", providers: ["builtin"] },
  "bank-search": { kind: "any", providers: ["builtin", "godseye"] },
  "vin-decoder": { kind: "any", providers: ["builtin"] },
  "car-insurance-us": { kind: "any", providers: ["builtin"] },
  "healthcare-us": { kind: "any", providers: ["builtin"] },
  "court-records": { kind: "any", providers: ["courtlistener", "builtin"] },
  "identity-search": { kind: "any", providers: ["builtin", "courtlistener"] },
  "npd-search": { kind: "any", providers: ["builtin", "courtlistener"] },
  "va-sex-offender": { kind: "any", providers: ["builtin"] },
  "global-public-records": { kind: "any", providers: ["builtin", "courtlistener"] },
  "sanctions-watchlists": { kind: "any", providers: ["builtin"] },
  "wanted-persons": { kind: "any", providers: ["builtin"] },
  "national-sor": { kind: "any", providers: ["builtin"] },
  "state-records-directory": { kind: "any", providers: ["builtin"] },
  "portal-backlog": { kind: "any", providers: ["builtin"] },
  "international-records-directory": { kind: "any", providers: ["builtin"] },
  "discord-id": {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint"],
  },
  roblox: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  minecraft: {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint"],
  },
  steam: { kind: "any", providers: ["osintcat", "godseye", "breachvip", "csint"] },
  xbox: { kind: "off" },
  playstation: { kind: "off" },
  telegram: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  instagram: { kind: "any", providers: ["instagram", "godseye", "csint"] },
  snapchat: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  tiktok: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  "tiktok-recon": { kind: "any", providers: ["csint"] },
  "share-resolver": { kind: "any", providers: ["csint"] },
  twitter: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  reddit: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  github: { kind: "any", providers: ["osintcat", "godseye", "csint"] },
  fivem: { kind: "any", providers: ["godseye"] },
  tinder: { kind: "any", providers: ["godseye", "csint"] },
  bumble: { kind: "any", providers: ["godseye", "csint"] },
  hinge: { kind: "any", providers: ["godseye", "csint"] },
  match: { kind: "any", providers: ["godseye", "csint"] },
  okcupid: { kind: "any", providers: ["godseye", "csint"] },
  pof: { kind: "any", providers: ["godseye", "csint"] },
  grindr: { kind: "any", providers: ["godseye", "csint"] },
  badoo: { kind: "any", providers: ["godseye", "csint"] },
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

async function probeInstagram(): Promise<boolean> {
  return probeInstagramAvailability();
}

export async function probeProviders(): Promise<ProviderHealth> {
  const [
    osintcat,
    godseye,
    godseyeExport,
    breachvip,
    csint,
    courtlistener,
    instagram,
  ] = await Promise.all([
    probeOsintCat(),
    probeGodsEye(),
    probeGodsEyeExport(),
    probeBreachVip(),
    probeCsint(),
    probeCourtListenerHealth(),
    probeInstagram(),
  ]);

  return {
    osintcat,
    godseye,
    "godseye-export": godseyeExport,
    breachvip,
    csint,
    builtin: true,
    courtlistener,
    instagram,
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
