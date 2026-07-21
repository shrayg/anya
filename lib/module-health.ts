import { probeBreachHub } from "@/lib/breachhub";
import { probeBreachVip } from "@/lib/breachvip";
import { probeCordCat, isCordCatConfigured } from "@/lib/cordcat";
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
  | "breachhub"
  | "csint"
  | "cordcat"
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
  intelx: { kind: "any", providers: ["godseye-export", "csint", "breachhub"] },
  "stealer-logs": {
    kind: "any",
    providers: ["osintcat", "godseye", "csint", "breachhub"],
  },
  breaches: {
    kind: "any",
    providers: [
      "builtin",
      "godseye",
      "breachvip",
      "csint",
      "breachhub",
      "osintcat",
    ],
  },
  domain: {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint", "breachhub"],
  },
  "hash-lookup": { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  "password-search": {
    kind: "any",
    providers: ["godseye", "breachvip", "csint", "breachhub"],
  },
  "name-search": {
    kind: "any",
    providers: [
      "godseye",
      "breachvip",
      "builtin",
      "courtlistener",
      "csint",
      "breachhub",
    ],
  },
  "email-analyze": { kind: "any", providers: ["csint", "breachhub"] },
  "fraud-footprint": { kind: "any", providers: ["csint"] },
  breachbase: { kind: "any", providers: ["csint", "breachhub"] },
  "oathnet-roblox": { kind: "any", providers: ["csint", "breachhub"] },
  "contact-enrich": { kind: "any", providers: ["csint"] },
  phone: {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint", "breachhub"],
  },
  username: {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint", "breachhub"],
  },
  "account-finder": { kind: "any", providers: ["builtin"] },
  ip: {
    kind: "any",
    providers: ["osintcat", "godseye", "breachvip", "csint", "breachhub"],
  },
  "shodan-host": { kind: "any", providers: ["csint"] },
  "site-pentest": { kind: "any", providers: ["builtin", "csint"] },
  "crypto-wallet": {
    kind: "any",
    providers: ["builtin", "godseye", "csint", "breachhub"],
  },
  "crypto-address": { kind: "any", providers: ["builtin"] },
  "crypto-tx": { kind: "any", providers: ["builtin"] },
  "crypto-risk": { kind: "any", providers: ["builtin"] },
  "crypto-flow": { kind: "any", providers: ["builtin"] },
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
  "global-public-records": {
    kind: "any",
    providers: ["builtin", "courtlistener"],
  },
  "sanctions-watchlists": { kind: "any", providers: ["builtin"] },
  "wanted-persons": { kind: "any", providers: ["builtin"] },
  "national-sor": { kind: "any", providers: ["builtin"] },
  "state-records-directory": { kind: "any", providers: ["builtin"] },
  "portal-backlog": { kind: "any", providers: ["builtin"] },
  "international-records-directory": { kind: "any", providers: ["builtin"] },
  "discord-id": {
    kind: "any",
    providers: [
      "cordcat",
      "osintcat",
      "godseye",
      "breachvip",
      "csint",
      "breachhub",
      "builtin",
    ],
  },
  roblox: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  minecraft: {
    kind: "any",
    providers: ["godseye", "breachvip", "csint", "breachhub"],
  },
  steam: {
    kind: "any",
    providers: ["godseye", "breachvip", "csint", "breachhub"],
  },
  xbox: { kind: "any", providers: ["breachhub"] },
  hwid: { kind: "any", providers: ["breachhub"] },
  "facebook-id": { kind: "any", providers: ["breachhub"] },
  passport: { kind: "any", providers: ["breachhub"] },
  "google-docs": { kind: "any", providers: ["breachhub"] },
  ganknow: { kind: "any", providers: ["breachhub"] },
  playstation: { kind: "off" },
  telegram: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  instagram: { kind: "any", providers: ["instagram", "godseye"] },
  snapchat: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  tiktok: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  "tiktok-recon": { kind: "any", providers: ["csint"] },
  "share-resolver": { kind: "any", providers: ["csint"] },
  twitter: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  reddit: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  github: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  fivem: { kind: "any", providers: ["godseye", "breachhub"] },
  tinder: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  "tinder-live": { kind: "any", providers: ["builtin"] },
  bumble: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  hinge: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  match: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  okcupid: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  pof: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  grindr: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
  badoo: { kind: "any", providers: ["godseye", "csint", "breachhub"] },
};

export type ProviderHealth = Record<ProviderId, boolean>;

export type ProviderProbeResult = {
  id: ProviderId;
  label: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  /** Cheap ping skipped (no key / not applicable). */
  unprobed?: boolean;
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  osintcat: "OsintCat",
  godseye: "GodsEye",
  "godseye-export": "GodsEye Export",
  breachvip: "BreachVIP",
  breachhub: "BreachHub",
  csint: "CSINT",
  cordcat: "CordCat",
  builtin: "Built-in",
  courtlistener: "CourtListener",
  instagram: "Instagram",
};

async function timedProbe(
  id: ProviderId,
  run: () => Promise<boolean>,
): Promise<ProviderProbeResult> {
  const started = Date.now();

  try {
    const ok = await run();

    return {
      id,
      label: PROVIDER_LABELS[id],
      ok,
      latencyMs: Date.now() - started,
      ...(ok ? {} : { error: "Probe failed" }),
    };
  } catch (err) {
    return {
      id,
      label: PROVIDER_LABELS[id],
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Probe failed",
    };
  }
}

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

export async function probeProvidersDetailed(): Promise<ProviderProbeResult[]> {
  const [
    osintcat,
    godseye,
    godseyeExport,
    breachvip,
    breachhub,
    csint,
    cordcat,
    courtlistener,
    instagram,
  ] = await Promise.all([
    timedProbe("osintcat", probeOsintCat),
    timedProbe("godseye", probeGodsEye),
    timedProbe("godseye-export", probeGodsEyeExport),
    timedProbe("breachvip", probeBreachVip),
    timedProbe("breachhub", probeBreachHub),
    timedProbe("csint", probeCsint),
    isCordCatConfigured()
      ? timedProbe("cordcat", probeCordCat)
      : Promise.resolve({
          id: "cordcat" as const,
          label: PROVIDER_LABELS.cordcat,
          ok: false,
          latencyMs: 0,
          unprobed: true,
          error: "Not configured",
        }),
    timedProbe("courtlistener", probeCourtListenerHealth),
    timedProbe("instagram", probeInstagram),
  ]);

  return [
    osintcat,
    godseye,
    godseyeExport,
    breachvip,
    breachhub,
    csint,
    cordcat,
    {
      id: "builtin",
      label: PROVIDER_LABELS.builtin,
      ok: true,
      latencyMs: 0,
    },
    courtlistener,
    instagram,
  ];
}

export async function probeProviders(): Promise<ProviderHealth> {
  const detailed = await probeProvidersDetailed();
  const out = {} as ProviderHealth;

  for (const row of detailed) {
    out[row.id] = row.ok;
  }

  return out;
}

function evaluateRule(
  rule: ModuleHealthRule,
  providers: ProviderHealth,
): boolean {
  if (rule.kind === "off") return false;

  if (rule.kind === "any") {
    return rule.providers.some((provider) => providers[provider]);
  }

  return rule.providers.every((provider) => providers[provider]);
}

export type ModuleHealthLevel = "ok" | "degraded" | "down";

function evaluateRuleLevel(
  rule: ModuleHealthRule,
  providers: ProviderHealth,
): ModuleHealthLevel {
  if (rule.kind === "off") return "down";

  const states = rule.providers.map((provider) => Boolean(providers[provider]));
  const up = states.filter(Boolean).length;
  const total = states.length;

  if (total === 0) return "down";
  if (rule.kind === "any") {
    if (up === 0) return "down";
    // Yellow when only the always-true builtin is up and paid indexes are down.
    if (
      up === 1 &&
      rule.providers.includes("builtin") &&
      providers.builtin &&
      total > 1
    ) {
      return "degraded";
    }

    return "ok";
  }

  if (up === total) return "ok";
  if (up === 0) return "down";

  return "degraded";
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

export function buildModuleHealthLevels(
  providers: ProviderHealth,
): Record<string, ModuleHealthLevel> {
  const modules: Record<string, ModuleHealthLevel> = {};

  for (const [slug, rule] of Object.entries(MODULE_HEALTH_RULES)) {
    modules[slug] = evaluateRuleLevel(rule, providers);
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

export function moduleLevelFromMap(
  slug: string,
  modules: Record<string, ModuleHealthLevel> | null | undefined,
): ModuleHealthLevel {
  if (modules && slug in modules) {
    return modules[slug] ?? "down";
  }

  return "down";
}
