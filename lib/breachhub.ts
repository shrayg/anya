/**
 * BreachHub.org unified intelligence client — full coverage of the public API.
 *
 * Docs: https://breachhub.org/docs · OpenAPI: https://breachhub.org/openapi.json
 * Auth: query param `key` (ApiKeyAuth). Disable with BREACHHUB_ENABLED=false.
 *
 * Sidebar sections mirrored here:
 * 1. Data Breach APIs
 * 2. Intelligence Platforms
 * 3. Social & OSINT
 * 4. Specialized Tools
 * 5. Network Intelligence
 * 6. User Lookup
 */

import type { CombCredential } from "@/lib/proxynova-comb";
import {
  mergeSanitizedResponses,
  type SanitizedBreachResponse,
} from "@/lib/osintcat";
import {
  isBrandPlaceholderValue,
  scrubIntelRecord,
  scrubIntelResults,
} from "@/lib/intel-record";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";

const BREACHHUB_BASE = "https://breachhub.org";
const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const MAX_ROWS = 200;
const MAX_ROWS_PER_SOURCE = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
const DISCORD_ID_RE = /^\d{17,20}$/;
const HASH_RE = /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const BTC_RE = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;

export type BreachHubSection =
  | "data_breach"
  | "intelligence_platform"
  | "social_osint"
  | "specialized_tools"
  | "network_intelligence"
  | "user_lookup";

export type BreachHubQueryKind =
  | "email"
  | "username"
  | "phone"
  | "ip"
  | "domain"
  | "hash"
  | "password"
  | "discord"
  | "steam"
  | "name"
  | "bin"
  | "vin"
  | "url"
  | "crypto"
  | "auto";

export type BreachHubEndpointMode =
  /** Fan into combined breach / platform searches when kinds match. */
  | "additive"
  /** Called from specialty modules / routes (steam, discord, bin, …). */
  | "specialty"
  /** Needs IDs from a prior search — exposed via fetchBreachHubRaw only. */
  | "followup";

export type BreachHubEndpointDef = {
  id: string;
  path: string;
  section: BreachHubSection;
  modes: BreachHubEndpointMode[];
  kinds: BreachHubQueryKind[];
  /** Build query params; return null to skip for this query. */
  buildParams: (
    query: string,
    kind: BreachHubQueryKind,
  ) => Record<string, string> | null;
};

export function getBreachHubApiKey(): string | undefined {
  const key = process.env.BREACHHUB_API_KEY?.trim();

  return key || undefined;
}

export function isBreachHubEnabled(): boolean {
  if (process.env.BREACHHUB_ENABLED === "false") return false;

  return Boolean(getBreachHubApiKey());
}

function sanitizeBreachHubError(message: string): string {
  const cleaned = sanitizePublicText(message).trim();

  if (!cleaned) return publicSearchError();

  const lower = cleaned.toLowerCase();

  if (
    lower.includes("quota") ||
    lower.includes("credit") ||
    (lower.includes("limit") &&
      (lower.includes("exceed") ||
        lower.includes("reached") ||
        lower.includes("daily")))
  ) {
    return "Provider quota exceeded for this source. Try again later.";
  }
  if (
    (lower.includes("rate") &&
      (lower.includes("limit") || lower.includes("429"))) ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("rate_limited")
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid api") ||
    lower.includes("missing api") ||
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower) ||
    /\b502\b/.test(lower) ||
    /\b503\b/.test(lower)
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // Never coerce objects — String({}) becomes "[object Object]".
  return "";
}

export function detectBreachHubQueryKind(
  query: string,
  hint?: string | null,
): BreachHubQueryKind {
  const trimmed = query.trim();
  const h = (hint || "").toLowerCase();

  const hints: BreachHubQueryKind[] = [
    "email",
    "phone",
    "username",
    "ip",
    "domain",
    "hash",
    "password",
    "discord",
    "steam",
    "name",
    "bin",
    "vin",
    "url",
    "crypto",
  ];

  if ((hints as string[]).includes(h)) return h as BreachHubQueryKind;

  if (EMAIL_RE.test(trimmed)) return "email";
  if (IP_RE.test(trimmed)) return "ip";
  if (DISCORD_ID_RE.test(trimmed)) return "discord";
  if (HASH_RE.test(trimmed)) return "hash";
  if (ETH_RE.test(trimmed) || BTC_RE.test(trimmed)) return "crypto";
  if (/^https?:\/\//i.test(trimmed) || /docs\.google\.com/i.test(trimmed)) {
    return "url";
  }
  if (/^\d{6,8}$/.test(trimmed)) return "bin";
  if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(trimmed)) return "vin";
  if (PHONE_RE.test(trimmed) && /\d{7,}/.test(trimmed.replace(/\D/g, ""))) {
    return "phone";
  }
  if (DOMAIN_RE.test(trimmed)) return "domain";

  return "username";
}

export function mapGodsEyeTypeToBreachHub(
  godseyeType: string,
): BreachHubQueryKind {
  switch (godseyeType) {
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "ip":
      return "ip";
    case "domain":
      return "domain";
    case "hash":
      return "hash";
    case "password":
      return "password";
    case "discord":
      return "discord";
    case "steam":
      return "steam";
    case "name":
      return "name";
    case "crypto":
      return "crypto";
    default:
      return "username";
  }
}

function q(query: string): Record<string, string> {
  return { query };
}

function categoryTerm(
  category: string,
  term: string,
): Record<string, string> {
  return { category, term };
}

function typeQuery(type: string, query: string): Record<string, string> {
  return { type, query };
}

function kindCategory(
  kind: BreachHubQueryKind,
): "email" | "username" | "password" | "phone" | "name" | null {
  if (kind === "email") return "email";
  if (kind === "password") return "password";
  if (kind === "phone") return "phone";
  if (kind === "name") return "name";
  if (
    kind === "username" ||
    kind === "domain" ||
    kind === "steam" ||
    kind === "discord"
  ) {
    return "username";
  }

  return null;
}

function breachVipCategory(kind: BreachHubQueryKind): string | null {
  switch (kind) {
    case "email":
      return "email";
    case "password":
      return "password";
    case "domain":
      return "domain";
    case "username":
      return "username";
    case "ip":
      return "ip";
    case "name":
      return "name";
    case "phone":
      return "phone";
    case "discord":
      return "discordid";
    case "steam":
      return "steamid";
    default:
      return null;
  }
}

function leaksightType(kind: BreachHubQueryKind): string | null {
  switch (kind) {
    case "email":
      return "email";
    case "username":
      return "username";
    case "password":
      return "password";
    case "phone":
      return "number";
    case "ip":
      return "ip";
    case "domain":
      return "subdomainsearch";
    case "url":
      return "url";
    default:
      return null;
  }
}

/**
 * Complete endpoint catalog — OpenAPI + live /api/status inventory.
 * Follow-up download endpoints are listed but never auto-fanout.
 */
export const BREACHHUB_ENDPOINTS: BreachHubEndpointDef[] = [
  // ─── 1. Data Breach APIs ─────────────────────────────────────────────
  {
    id: "snusbase",
    path: "/api/snusbase",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "ip", "hash", "phone", "domain", "password"],
    buildParams: (query) => q(query),
  },
  {
    id: "snusbase-combo",
    path: "/api/snusbase/combo-lookup",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["username", "password"],
    buildParams: (query, kind) =>
      typeQuery(kind === "password" ? "password" : "username", query),
  },
  {
    id: "snusbase-hash",
    path: "/api/snusbase/hash-lookup",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["hash", "password"],
    buildParams: (query, kind) =>
      typeQuery(kind === "password" ? "password" : "hash", query),
  },
  {
    id: "snusbase-ip-whois",
    path: "/api/snusbase/ip-whois",
    section: "data_breach",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "leakosint",
    path: "/api/leakosint",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "leakcheck-v2",
    path: "/api/leakcheck/v2",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachbase",
    path: "/api/breachbase",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query, kind) => {
      const cat = kindCategory(kind);

      return cat === "email" || cat === "username"
        ? categoryTerm(cat, query)
        : null;
    },
  },
  {
    id: "intelvault",
    path: "/api/intelvault",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "breachdirectory",
    path: "/api/breachdirectory",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "ip"],
    buildParams: (query, kind) => {
      const type =
        kind === "email" ? "email" : kind === "ip" ? "ip" : "username";

      return typeQuery(type, query);
    },
  },
  {
    id: "hackcheck",
    path: "/api/hackcheck",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "password"],
    buildParams: (query, kind) => {
      const cat = kindCategory(kind);

      return cat === "email" || cat === "username" || cat === "password"
        ? categoryTerm(cat, query)
        : null;
    },
  },
  {
    id: "osintkit",
    path: "/api/osintkit",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "phone", "name"],
    buildParams: (query, kind) => {
      const cat = kindCategory(kind);

      return cat ? categoryTerm(cat, query) : null;
    },
  },
  {
    id: "breachvip",
    path: "/api/breachvip",
    section: "data_breach",
    modes: ["additive"],
    kinds: [
      "email",
      "password",
      "domain",
      "username",
      "ip",
      "name",
      "phone",
      "discord",
      "steam",
    ],
    buildParams: (query, kind) => {
      const category = breachVipCategory(kind);

      return category ? { category, query } : null;
    },
  },
  {
    id: "cordcat",
    path: "/api/cordcat",
    section: "data_breach",
    modes: ["additive", "specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ id: query }),
  },
  {
    id: "cordcat-ip",
    path: "/api/cordcat/ip",
    section: "data_breach",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "intelx",
    path: "/api/intelx",
    section: "data_breach",
    modes: ["specialty", "followup"],
    kinds: ["hash"],
    buildParams: (query) =>
      HASH_RE.test(query) ? { system_id: query } : null,
  },
  {
    id: "osintcat-database",
    path: "/api/osintcat/database-search",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "domain", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintcat-twitter",
    path: "/api/osintcat/twitter-osint",
    section: "data_breach",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "osintcat-machine-search",
    path: "/api/osintcat/machine-viewer/search",
    section: "data_breach",
    modes: ["specialty"],
    kinds: ["email", "username", "domain", "ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintcat-machine-info",
    path: "/api/osintcat/machine-viewer/machines/:machine_id/info",
    section: "data_breach",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "osintcat-machine-tree",
    path: "/api/osintcat/machine-viewer/machines/:machine_id/files/treeview",
    section: "data_breach",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "osintcat-file-info",
    path: "/api/osintcat/machine-viewer/files/:file_id/info",
    section: "data_breach",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "osintcat-file-download",
    path: "/api/osintcat/machine-viewer/files/:file_id/download",
    section: "data_breach",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "osintcat-machine-download",
    path: "/api/osintcat/machine-viewer/machines/:machine_id/download",
    section: "data_breach",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "xosint",
    path: "/api/xosint/search",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "seeknow-search",
    path: "/api/seeknow/search",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "phone", "username", "ip", "hash"],
    buildParams: (query, kind) => ({
      query,
      type: kind === "auto" ? "email" : kind,
      limit: "50",
    }),
  },
  {
    id: "seeknow-stealer",
    path: "/api/seeknow/stealer",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "domain"],
    buildParams: (query) => ({ query, limit: "50" }),
  },
  {
    id: "seekria-email-breach",
    path: "/api/seekria/email-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-username-breach",
    path: "/api/seekria/username-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["username", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-phone-breach",
    path: "/api/seekria/phone-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-email-breach",
    path: "/api/osintbat/email-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-username-breach",
    path: "/api/osintbat/username-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["username", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-phone-breach",
    path: "/api/osintbat/phone-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-facebook-breach",
    path: "/api/osintbat/facebook-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "name"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-database-breach",
    path: "/api/osintbat/database-breach",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "eye-all",
    path: "/api/eye-all",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "infodra",
    path: "/api/infodra",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip"],
    buildParams: (query, kind) => {
      const cat =
        kind === "email"
          ? "email"
          : kind === "phone"
            ? "phone"
            : kind === "ip"
              ? "ip"
              : "username";

      return { category: cat, query };
    },
  },
  {
    id: "akula",
    path: "/api/akula",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain"],
    buildParams: (query, kind) =>
      categoryTerm(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "cypherdynamics",
    path: "/api/cypherdynamics",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "domain", "ip"],
    buildParams: (query, kind) => ({
      category: kind === "auto" ? "email" : kind,
      query,
    }),
  },
  // IntelBase proxies (OpenAPI)
  {
    id: "intelbase-unified",
    path: "/api/intelbase/unified",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain"],
    buildParams: (query, kind) =>
      typeQuery(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "intelbase-email-check",
    path: "/api/intelbase/email/check",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-leakcheck",
    path: "/api/intelbase/leakcheck",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query, kind) =>
      typeQuery(kind === "username" ? "username" : "email", query),
  },
  {
    id: "intelbase-hackcheck",
    path: "/api/intelbase/hackcheck",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query, kind) =>
      typeQuery(kind === "username" ? "username" : "email", query),
  },
  {
    id: "intelbase-leakosint",
    path: "/api/intelbase/leakosint",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-breachvip",
    path: "/api/intelbase/breachvip",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain"],
    buildParams: (query, kind) =>
      typeQuery(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "intelbase-intelvault-breaches",
    path: "/api/intelbase/intelvault/breaches",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query, kind) =>
      typeQuery(kind === "username" ? "username" : "email", query),
  },
  {
    id: "intelbase-intelvault-stealer",
    path: "/api/intelbase/intelvault/stealer-logs",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-intelvault-email",
    path: "/api/intelbase/intelvault/email",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-intelvault-username",
    path: "/api/intelbase/intelvault/username",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-akula",
    path: "/api/intelbase/akula",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-leaksight",
    path: "/api/intelbase/leaksight",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-search",
    path: "/api/intelbase/search",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain"],
    buildParams: (query, kind) =>
      typeQuery(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "intelfetch-fetchbase",
    path: "/api/intelfetch/fetchbase",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "indicia-email",
    path: "/api/indicia/email",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "indicia-gmail",
    path: "/api/indicia/gmail",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "indicia-web-dbs",
    path: "/api/indicia/web-dbs",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query) => ({ query, services: "all" }),
  },

  // ─── 2. Intelligence Platforms ───────────────────────────────────────
  {
    id: "breachhub-search",
    path: "/api/breachhub/search",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain", "hash"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachhub-fivem",
    path: "/api/breachhub/fivem",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["discord", "ip", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachhub-google-docs",
    path: "/api/breachhub/google-osint/docs",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["url"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachhub-ganknow",
    path: "/api/breachhub/ganknow/profil",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "breachhub-email-osint",
    path: "/api/breachhub/email-osint",
    section: "intelligence_platform",
    modes: ["specialty", "additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachhub-xbox",
    path: "/api/breachhub/xbox-lookup",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "breachhub-steam",
    path: "/api/breachhub/steam",
    section: "intelligence_platform",
    modes: ["specialty", "additive"],
    kinds: ["steam"],
    buildParams: (query) => ({ steam_id: query }),
  },
  {
    id: "breachhub-crypto",
    path: "/api/breachhub/crypto",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["crypto"],
    buildParams: (query) => {
      if (ETH_RE.test(query)) return { category: "eth", term: query };
      if (BTC_RE.test(query)) return { category: "btc", term: query };

      return null;
    },
  },
  {
    id: "hudsonrock-email",
    path: "/api/hudsonrock/search-by-login/emails",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "hudsonrock-username",
    path: "/api/hudsonrock/search-by-login/usernames",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "hudsonrock-domain",
    path: "/api/hudsonrock/search-by-domain",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "hudsonrock-domain-overview",
    path: "/api/hudsonrock/search-by-domain/overview",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "hudsonrock-domain-assessment",
    path: "/api/hudsonrock/search-by-domain/assessment",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "hudsonrock-domain-discovery",
    path: "/api/hudsonrock/search-by-domain/discovery",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "hudsonrock-ip",
    path: "/api/hudsonrock/search-by-ip",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "hudsonrock-keyword",
    path: "/api/hudsonrock/search-by-keyword",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username", "name", "domain"],
    buildParams: (query) => ({ keyword: query }),
  },
  {
    id: "hudsonrock-keyword-urls",
    path: "/api/hudsonrock/search-by-keyword/urls",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username", "domain", "url"],
    buildParams: (query) => ({ keyword: query }),
  },
  {
    id: "hudsonrock-legacy",
    path: "/api/hudsonrock",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "leaksight",
    path: "/api/leaksight",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email", "username", "password", "phone", "ip", "domain", "url"],
    buildParams: (query, kind) => {
      const type = leaksightType(kind);

      return type ? typeQuery(type, query) : null;
    },
  },
  {
    id: "leaksight-hwid",
    path: "/api/leaksight",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username", "hash"],
    buildParams: (query) => typeQuery("hwid", query),
  },
  {
    id: "leaksight-facebook",
    path: "/api/leaksight",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username"],
    // OpenAPI enum has no facebook type — searchstring accepts FB profile IDs.
    buildParams: (query) => typeQuery("searchstring", query),
  },
  {
    id: "leaksight-passport",
    path: "/api/leaksight",
    section: "intelligence_platform",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => typeQuery("searchstring", query),
  },
  {
    id: "wentyn",
    path: "/api/wentyn",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email", "domain"],
    buildParams: (query, kind) =>
      typeQuery(kind === "domain" ? "domain" : "email", query),
  },

  // ─── 3. Social & OSINT ───────────────────────────────────────────────
  {
    id: "oathnet-breach",
    path: "/api/oathnet/breach",
    section: "social_osint",
    modes: ["additive"],
    kinds: ["email", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "oathnet-stealer",
    path: "/api/oathnet/stealer",
    section: "social_osint",
    modes: ["additive"],
    kinds: ["email", "domain", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "oathnet-stealer-subdomain",
    path: "/api/oathnet/stealer-subdomain",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "oathnet-extract-subdomain",
    path: "/api/oathnet/extract-subdomain",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query, is_alive: "true" }),
  },
  {
    id: "oathnet-victims",
    path: "/api/oathnet/victims",
    section: "social_osint",
    modes: ["additive"],
    kinds: ["email", "domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "oathnet-victims-log",
    path: "/api/oathnet/victims/:log_id",
    section: "social_osint",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "oathnet-victims-file",
    path: "/api/oathnet/victims/:log_id/files/:file_id",
    section: "social_osint",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "oathnet-victims-archive",
    path: "/api/oathnet/victims/:log_id/archive",
    section: "social_osint",
    modes: ["followup"],
    kinds: [],
    buildParams: () => null,
  },
  {
    id: "oathnet-discord-userinfo",
    path: "/api/oathnet/discord-userinfo",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "oathnet-discord-history",
    path: "/api/oathnet/discord-username-history",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "oathnet-discord-roblox",
    path: "/api/oathnet/discord-to-roblox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "oathnet-steam",
    path: "/api/oathnet/steam",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["steam"],
    buildParams: (query) => ({ steam_id: query }),
  },
  {
    id: "oathnet-xbox",
    path: "/api/oathnet/xbox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ xbl_id: query }),
  },
  {
    id: "oathnet-roblox",
    path: "/api/oathnet/roblox-userinfo",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "oathnet-mc",
    path: "/api/oathnet/mc-history",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "oathnet-ip",
    path: "/api/oathnet/ip-info",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "oathnet-holehe",
    path: "/api/oathnet/holehe",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "oathnet-ghunt",
    path: "/api/oathnet/ghunt",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "seon-email",
    path: "/api/seon/email",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "seon-phone",
    path: "/api/seon/phone",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["phone"],
    buildParams: (query) => ({ phone: query }),
  },
  {
    id: "seon-ip",
    path: "/api/seon/ip",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "seon-bin",
    path: "/api/seon/bin",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["bin"],
    buildParams: (query) => ({ bin: query }),
  },
  {
    id: "seon-email-verification",
    path: "/api/seon/email-verification",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "truecaller",
    path: "/api/truecaller",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["phone"],
    buildParams: (query) => ({ phone: query }),
  },
  {
    id: "memorylol",
    path: "/api/memory",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "tiktok",
    path: "/api/tiktok",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ type: "username", username: query }),
  },
  {
    id: "room101-user",
    path: "/api/room101/user",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "room101-analyze",
    path: "/api/room101/analyze",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "room101-search",
    path: "/api/room101/v2/search",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username", "name"],
    buildParams: (query) => ({ terms: query }),
  },
  {
    id: "room101-subreddit",
    path: "/api/room101/subreddit",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ name: query }),
  },
  {
    id: "nosint-search",
    path: "/api/nosint/search",
    section: "social_osint",
    modes: ["additive"],
    kinds: ["email", "username", "phone"],
    buildParams: (query, kind) =>
      typeQuery(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "nosint-ip",
    path: "/api/nosint/ip",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "reconly",
    path: "/api/reconly",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["discord", "username", "email"],
    buildParams: (query, kind) => ({
      mode:
        kind === "discord" ? "discord" : kind === "email" ? "email" : "username",
      query,
    }),
  },
  {
    id: "reconly-fivem",
    path: "/api/reconly",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord", "username"],
    buildParams: (query) => ({ mode: "fivem", query }),
  },
  {
    id: "seekria-email-osint",
    path: "/api/seekria/email-osint",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["email"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-user-footprint",
    path: "/api/seekria/user-footprint",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-domain",
    path: "/api/seekria/domain-lookup",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-discord",
    path: "/api/seekria/discord",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-roblox",
    path: "/api/seekria/roblox",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-minecraft",
    path: "/api/seekria/minecraft",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-ip",
    path: "/api/seekria/ip",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-dns",
    path: "/api/seekria/dns-resolver",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "seeknow-discord-user",
    path: "/api/seeknow/discord/user",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "seeknow-discord-roblox",
    path: "/api/seeknow/discord/to-roblox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "seeknow-github",
    path: "/api/seeknow/username/github",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-twitter",
    path: "/api/seeknow/username/twitter",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-tiktok",
    path: "/api/seeknow/username/tiktok",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-reddit",
    path: "/api/seeknow/username/reddit",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-social",
    path: "/api/seeknow/username/social",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-history",
    path: "/api/seeknow/username/history",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-ip",
    path: "/api/seeknow/network/ip",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "seeknow-email-check",
    path: "/api/seeknow/network/email-check",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "seeknow-phone",
    path: "/api/seeknow/network/phone",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["phone"],
    buildParams: (query) => ({ phone: query }),
  },
  {
    id: "seeknow-domain-intel",
    path: "/api/seeknow/domain/intel",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "seeknow-domain-whois",
    path: "/api/seeknow/domain/whois",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "seeknow-xbox",
    path: "/api/seeknow/gaming/xbox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ gamertag: query }),
  },
  {
    id: "seeknow-roblox",
    path: "/api/seeknow/gaming/roblox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "seeknow-minecraft",
    path: "/api/seeknow/gaming/minecraft",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "osintbat-phone",
    path: "/api/osintbat/phone-osint",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-github",
    path: "/api/osintbat/github-osint",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-twitter",
    path: "/api/osintbat/twitter-osint",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-discord",
    path: "/api/osintbat/discord",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-roblox",
    path: "/api/osintbat/roblox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-minecraft",
    path: "/api/osintbat/minecraft",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-ip",
    path: "/api/osintbat/ip",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "osintbat-dns",
    path: "/api/osintbat/dns",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-phone",
    path: "/api/intelbase/phone",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-github",
    path: "/api/intelbase/github",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-tiktok",
    path: "/api/intelbase/tiktok",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-discord",
    path: "/api/intelbase/discord/lookup",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-minecraft",
    path: "/api/intelbase/minecraft",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-roblox",
    path: "/api/intelbase/roblox",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => typeQuery("username", query),
  },
  {
    id: "intelbase-reddit",
    path: "/api/intelbase/reddit",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-seon",
    path: "/api/intelbase/seon",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["email", "phone", "ip"],
    buildParams: (query, kind) =>
      typeQuery(kind === "auto" ? "email" : kind, query),
  },
  {
    id: "intelbase-doxbin",
    path: "/api/intelbase/doxbin",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username", "email", "name"],
    buildParams: (query, kind) =>
      typeQuery(kind === "email" ? "email" : "username", query),
  },

  // ─── 4. Specialized Tools ────────────────────────────────────────────
  {
    id: "binlist",
    path: "/api/binlist",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["bin"],
    buildParams: (query) => ({ bin: query }),
  },
  {
    id: "vin",
    path: "/api/vin",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["vin"],
    buildParams: (query) => ({ type: "vin", query }),
  },
  {
    id: "inf0sec",
    path: "/api/inf0sec",
    section: "specialized_tools",
    modes: ["additive", "specialty"],
    kinds: ["email", "username", "ip", "domain", "phone", "name"],
    buildParams: (query, kind) => ({
      module: kind === "auto" ? "email" : kind,
      query,
    }),
  },
  {
    id: "melissa",
    path: "/api/melissa",
    section: "specialized_tools",
    modes: ["specialty", "additive"],
    kinds: ["email", "phone", "ip"],
    buildParams: (query) => ({ input: query }),
  },
  {
    id: "checko",
    path: "/api/checko",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ inn: query }),
  },
  {
    id: "intelbase-vin",
    path: "/api/intelbase/vin",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["vin"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-bmw",
    path: "/api/intelbase/bmw",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["vin", "username", "name"],
    buildParams: (query, kind) =>
      typeQuery(kind === "vin" ? "vin" : "owner", query),
  },
  {
    id: "intelbase-npd",
    path: "/api/intelbase/npd",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["email", "phone", "name"],
    buildParams: (query, kind): Record<string, string> | null => {
      if (kind === "email") return { email: query };
      if (kind === "phone") return { phone: query };

      const parts = query.split(/\s+/);

      if (parts.length >= 2) {
        return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
      }

      return { last_name: query };
    },
  },
  {
    id: "intelbase-court",
    path: "/api/intelbase/court",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["name", "username"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelbase-ip",
    path: "/api/intelbase/ip/lookup",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => q(query),
  },
  {
    id: "datavoid-stealer",
    path: "/api/datavoid/stealer",
    section: "specialized_tools",
    modes: ["additive"],
    kinds: ["email", "domain"],
    buildParams: (query) => ({ q: query }),
  },
  {
    id: "datavoid-recovery",
    path: "/api/datavoid/recovery",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["email", "username", "phone", "name"],
    buildParams: (query) => ({ q: query }),
  },
  {
    id: "datavoid-instagram",
    path: "/api/datavoid/instagram",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["username", "email"],
    buildParams: (query, kind) => ({
      query,
      field: kind === "email" ? "email" : "username",
    }),
  },
  {
    id: "indicia-whois",
    path: "/api/indicia/whois",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelfetch-domain",
    path: "/api/intelfetch/domain",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },

  // ─── 5. Network Intelligence ─────────────────────────────────────────
  {
    id: "ipinfo",
    path: "/api/ipinfo",
    section: "network_intelligence",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "shodan-host",
    path: "/api/shodan/host",
    section: "network_intelligence",
    modes: ["specialty", "additive"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "shodan-search",
    path: "/api/shodan/search",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["username", "domain", "ip"],
    buildParams: (query) => ({ query }),
  },
  {
    id: "shodan-dns",
    path: "/api/shodan/dns",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "shodan-dns-resolve",
    path: "/api/shodan/dns/resolve",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ hostnames: query }),
  },
  {
    id: "shodan-dns-reverse",
    path: "/api/shodan/dns/reverse",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ips: query }),
  },
  {
    id: "shodan-honeyscore",
    path: "/api/shodan/honeyscore",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "intelfetch-ip",
    path: "/api/intelfetch/ip-lookup",
    section: "network_intelligence",
    modes: ["specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },

  // ─── 6. User Lookup ──────────────────────────────────────────────────
  {
    id: "github",
    path: "/api/github",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["username", "email"],
    buildParams: (query, kind): Record<string, string> | null =>
      kind === "email" ? { email: query } : { username: query },
  },
  {
    id: "discord-lookup",
    path: "/api/discord/discord-lookup",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "discord-stalker",
    path: "/api/discord/discord-stalker",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "telegram-username",
    path: "/api/telegram/username",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => ({ query, mode: "username" }),
  },
  {
    id: "telegram-id",
    path: "/api/telegram/id",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "telegram-phone",
    path: "/api/telegram/phone",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "snapchat",
    path: "/api/snapchat",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "instagram",
    path: "/api/instagram",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username", "email", "phone"],
    buildParams: (query, kind): Record<string, string> | null => {
      if (kind === "email") return { email: query };
      if (kind === "phone") return { phone: query };

      return { username: query };
    },
  },
  {
    id: "instagram-id",
    path: "/api/instagram/id",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "medal",
    path: "/api/medal",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query, type: "username" }),
  },
  {
    id: "intelfetch-discord",
    path: "/api/intelfetch/discord",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "intelfetch-github",
    path: "/api/intelfetch/github",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
  },
  {
    id: "indicia-roblox",
    path: "/api/indicia/roblox",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "indicia-tiktok",
    path: "/api/indicia/tiktok",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "indicia-discord",
    path: "/api/indicia/discord",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "nbrs-roblox",
    path: "/api/nbrs/roblox",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim();

      return /^\d+$/.test(cleaned)
        ? { playerid: cleaned }
        : { username: cleaned };
    },
  },
];

export function listBreachHubEndpoints(filter?: {
  section?: BreachHubSection;
  mode?: BreachHubEndpointMode;
}): BreachHubEndpointDef[] {
  return BREACHHUB_ENDPOINTS.filter((endpoint) => {
    if (filter?.section && endpoint.section !== filter.section) return false;
    if (filter?.mode && !endpoint.modes.includes(filter.mode)) return false;

    return true;
  });
}

function resolvePath(
  pathTemplate: string,
  pathParams: Record<string, string>,
): string {
  return pathTemplate.replace(/:([a-zA-Z_]+)/g, (_, key: string) => {
    const value = pathParams[key];

    if (!value) {
      throw new Error(publicSearchError(`Missing path parameter: ${key}`));
    }

    return encodeURIComponent(value);
  });
}

export async function breachHubGet(
  path: string,
  params: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pathParams: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const apiKey = getBreachHubApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const resolved = resolvePath(path, pathParams);
  const url = new URL(
    resolved.startsWith("http") ? resolved : `${BREACHHUB_BASE}${resolved}`,
  );

  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const started = Date.now();
  const res = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "AnyaInt-BreachHub/1.0",
    },
    cache: "no-store",
    timeoutMs,
  });

  const remaining = Math.max(2_000, timeoutMs - (Date.now() - started));
  const text = await readResponseText(res, remaining);
  let data: Record<string, unknown> = {};

  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    if (!res.ok) {
      throw new Error(sanitizeBreachHubError(`HTTP ${res.status}`));
    }
    throw new Error(
      publicSearchError("Invalid response from intelligence index."),
    );
  }

  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;

    throw new Error(sanitizeBreachHubError(msg));
  }

  if (data.success === false) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "Search failed";

    throw new Error(sanitizeBreachHubError(msg));
  }

  return data;
}

function stripMetaFields(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...record };

  for (const key of [
    "credit",
    "credits",
    "service",
    "powered_by",
    "lookup_made_by",
  ]) {
    delete out[key];
  }

  return out;
}

function pushRecord(rows: Record<string, unknown>[], entry: unknown) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;

  const scrubbed = scrubIntelRecord(
    stripMetaFields(entry as Record<string, unknown>),
  );

  if (scrubbed) rows.push(scrubbed);
}

export function extractBreachHubRows(
  payload: unknown,
): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const rows: Record<string, unknown>[] = [];

  const pushLimited = (list: unknown[]) => {
    for (const item of list.slice(0, MAX_ROWS_PER_SOURCE)) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;

        if (Array.isArray(obj.entries)) {
          const sourceName = asString(obj.source) || asString(obj.name);

          for (const entry of obj.entries.slice(0, MAX_ROWS_PER_SOURCE)) {
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
              pushRecord(rows, {
                ...(entry as Record<string, unknown>),
                ...(sourceName &&
                !asString((entry as Record<string, unknown>).database)
                  ? { database: sourceName }
                  : {}),
              });
            }
          }
          continue;
        }

        if (
          obj.source &&
          typeof obj.source === "object" &&
          !Array.isArray(obj.source)
        ) {
          const src = obj.source as Record<string, unknown>;
          const name = asString(src.name);

          pushRecord(rows, {
            ...obj,
            ...(name ? { database: name } : {}),
            source: undefined,
          });
          continue;
        }

        if (asString(obj.origin) && !asString(obj.database)) {
          pushRecord(rows, { ...obj, database: asString(obj.origin) });
          continue;
        }

        if (asString(obj.title) && !asString(obj.database)) {
          pushRecord(rows, { ...obj, database: asString(obj.title) });
          continue;
        }

        if (asString(obj.dbname) && !asString(obj.database)) {
          pushRecord(rows, { ...obj, database: asString(obj.dbname) });
          continue;
        }
      }

      pushRecord(rows, item);
    }
  };

  if (Array.isArray(data.results)) {
    pushLimited(data.results);
  } else if (data.results && typeof data.results === "object") {
    const nested = data.results as Record<string, unknown>;

    if (Array.isArray(nested.results)) {
      pushLimited(nested.results);
    } else if (
      nested.results &&
      typeof nested.results === "object" &&
      !Array.isArray(nested.results)
    ) {
      const deeper = nested.results as Record<string, unknown>;

      if (Array.isArray(deeper.results)) pushLimited(deeper.results);
      else if (Array.isArray(deeper.data)) pushLimited(deeper.data);
      else pushRecord(rows, deeper);
    } else if (Array.isArray(nested.data)) {
      pushLimited(nested.data);
    } else {
      pushRecord(rows, nested);
    }
  }

  if (rows.length === 0 && Array.isArray(data.data)) {
    pushLimited(data.data);
  }

  if (rows.length === 0 && Array.isArray(data.services)) {
    pushLimited(data.services);
  }

  if (rows.length === 0) {
    const profile = data.profile;

    if (profile && typeof profile === "object" && !Array.isArray(profile)) {
      pushRecord(rows, {
        ...(profile as Record<string, unknown>),
        ...(asString(data.steamid64)
          ? { steamid64: asString(data.steamid64) }
          : {}),
        ...(asString(data.wallet) ? { wallet: asString(data.wallet) } : {}),
      });
    } else if (
      asString(data.wallet) ||
      asString(data.steamid64) ||
      asString(data.balance) ||
      Array.isArray(data.sources)
    ) {
      pushRecord(rows, stripMetaFields(data));
    }
  }

  return rows.slice(0, MAX_ROWS);
}

function reportedCount(payload: Record<string, unknown>): number | undefined {
  for (const key of [
    "found_total",
    "count",
    "total_entries",
    "found",
    "total",
    "breaches",
  ]) {
    const n = payload[key];

    if (typeof n === "number" && Number.isFinite(n) && n >= 0) return n;
  }

  return undefined;
}

function toSanitized(
  payload: unknown,
  reported?: number,
): SanitizedBreachResponse {
  const results = scrubIntelResults(extractBreachHubRows(payload));
  const count =
    typeof reported === "number" && reported > results.length
      ? reported
      : results.length;

  return { count, results };
}

async function fetchEndpointSafe(
  endpoint: BreachHubEndpointDef,
  query: string,
  kind: BreachHubQueryKind,
  timeoutMs: number,
): Promise<SanitizedBreachResponse | null> {
  const params = endpoint.buildParams(query, kind);

  if (!params) return null;

  try {
    const data = await breachHubGet(endpoint.path, params, timeoutMs);

    return toSanitized(data, reportedCount(data));
  } catch {
    return null;
  }
}

async function fanOutEndpoints(
  endpoints: BreachHubEndpointDef[],
  query: string,
  kind: BreachHubQueryKind,
  timeoutMs: number,
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled() || endpoints.length === 0) return null;

  const trimmed = query.trim();

  if (!trimmed) return null;

  const settled = await Promise.allSettled(
    endpoints.map((endpoint) =>
      fetchEndpointSafe(endpoint, trimmed, kind, timeoutMs),
    ),
  );

  const parts: SanitizedBreachResponse[] = [];

  for (const result of settled) {
    if (
      result.status === "fulfilled" &&
      result.value &&
      result.value.count > 0
    ) {
      parts.push(result.value);
    }
  }

  if (parts.length === 0) return null;

  const merged = mergeSanitizedResponses(...parts);

  return merged.count > 0 ? merged : null;
}

function additiveForKind(kind: BreachHubQueryKind): BreachHubEndpointDef[] {
  return BREACHHUB_ENDPOINTS.filter(
    (endpoint) =>
      endpoint.modes.includes("additive") &&
      (endpoint.kinds.includes(kind) ||
        (kind !== "auto" && endpoint.kinds.includes("auto"))),
  );
}

function stealerLikeEndpoints(kind: BreachHubQueryKind): BreachHubEndpointDef[] {
  const stealerIds = new Set([
    "oathnet-stealer",
    "oathnet-stealer-subdomain",
    "oathnet-victims",
    "seeknow-stealer",
    "hudsonrock-email",
    "hudsonrock-username",
    "hudsonrock-domain",
    "hudsonrock-ip",
    "hudsonrock-legacy",
    "wentyn",
    "intelbase-intelvault-stealer",
    "datavoid-stealer",
  ]);

  return BREACHHUB_ENDPOINTS.filter(
    (endpoint) =>
      stealerIds.has(endpoint.id) &&
      endpoint.kinds.includes(kind) &&
      endpoint.modes.includes("additive"),
  );
}

/** Full additive fan-out across Data Breach + overlapping Social/Intel indexes. */
export async function fetchBreachHubAdditiveBreachSearch(
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const kind = detectBreachHubQueryKind(query, kindHint);
  const endpoints = additiveForKind(kind).filter(
    (endpoint) => !stealerLikeEndpoints(kind).includes(endpoint),
  );

  return fanOutEndpoints(endpoints, query, kind, timeoutMs);
}

/** Stealer / infection indexes. */
export async function fetchBreachHubAdditiveStealerSearch(
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const kind = detectBreachHubQueryKind(query, kindHint);

  return fanOutEndpoints(stealerLikeEndpoints(kind), query, kind, timeoutMs);
}

/** Combined breach + stealer. */
export async function fetchBreachHubSanitized(
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse> {
  if (!isBreachHubEnabled()) return { count: 0, results: [] };

  const [breach, stealer] = await Promise.all([
    fetchBreachHubAdditiveBreachSearch(query, kindHint, timeoutMs),
    fetchBreachHubAdditiveStealerSearch(query, kindHint, timeoutMs),
  ]);

  const parts = [breach, stealer].filter(
    (part): part is SanitizedBreachResponse => Boolean(part && part.count > 0),
  );

  if (parts.length === 0) return { count: 0, results: [] };

  return mergeSanitizedResponses(...parts);
}

export async function fetchBreachHubByIds(
  ids: string[],
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const kind = detectBreachHubQueryKind(query, kindHint);
  const idSet = new Set(ids);
  const endpoints = BREACHHUB_ENDPOINTS.filter((endpoint) =>
    idSet.has(endpoint.id),
  );

  return fanOutEndpoints(endpoints, query, kind, timeoutMs);
}

export async function fetchBreachHubSpecialty(
  scope: string,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const map: Record<string, string[]> = {
    steam: ["breachhub-steam", "oathnet-steam"],
    xbox: ["breachhub-xbox", "oathnet-xbox", "seeknow-xbox"],
    roblox: [
      "nbrs-roblox",
      "seeknow-roblox",
      "oathnet-roblox",
      "seekria-roblox",
      "osintbat-roblox",
      "intelbase-roblox",
      "indicia-roblox",
    ],
    minecraft: [
      "oathnet-mc",
      "seekria-minecraft",
      "seeknow-minecraft",
      "osintbat-minecraft",
      "intelbase-minecraft",
    ],
    discord: [
      "seeknow-discord-user",
      "reconly",
      "discord-lookup",
      "discord-stalker",
      "cordcat",
      "oathnet-discord-userinfo",
      "oathnet-discord-history",
      "seekria-discord",
      "osintbat-discord",
      "intelbase-discord",
      "intelfetch-discord",
      "indicia-discord",
    ],
    "discord-roblox": ["seeknow-discord-roblox", "oathnet-discord-roblox"],
    telegram: ["telegram-username", "telegram-phone"],
    snapchat: ["snapchat"],
    tiktok: ["tiktok", "seeknow-tiktok", "intelbase-tiktok", "indicia-tiktok"],
    twitter: ["seeknow-twitter", "osintcat-twitter", "osintbat-twitter"],
    reddit: ["room101-user", "room101-analyze", "seeknow-reddit", "intelbase-reddit"],
    github: ["github", "osintbat-github", "seeknow-github", "intelfetch-github", "intelbase-github"],
    instagram: ["instagram", "datavoid-instagram"],
    fivem: ["breachhub-fivem", "reconly-fivem"],
    phone: [
      "seeknow-phone",
      "nosint-search",
      "truecaller",
      "seon-phone",
      "osintbat-phone",
      "intelbase-phone",
      "telegram-phone",
    ],
    ip: [
      "ipinfo",
      "snusbase-ip-whois",
      "oathnet-ip",
      "seekria-ip",
      "shodan-host",
      "cordcat-ip",
      "seon-ip",
      "osintbat-ip",
      "intelfetch-ip",
      "intelbase-ip",
    ],
    domain: [
      "hudsonrock-domain",
      "hudsonrock-domain-overview",
      "oathnet-stealer-subdomain",
      "oathnet-extract-subdomain",
      "seekria-domain",
      "seekria-dns",
      "seeknow-domain-intel",
      "seeknow-domain-whois",
      "indicia-whois",
      "intelfetch-domain",
      "shodan-dns",
    ],
    email: [
      "seeknow-email-check",
      "nosint-search",
      "oathnet-holehe",
      "oathnet-ghunt",
      "breachhub-email-osint",
      "seekria-email-osint",
      "seon-email",
      "seon-email-verification",
    ],
    hwid: ["leaksight-hwid"],
    facebook: ["leaksight-facebook", "osintbat-facebook-breach"],
    passport: ["leaksight-passport"],
    crypto: ["breachhub-crypto"],
    "google-docs": ["breachhub-google-docs"],
    ganknow: ["breachhub-ganknow"],
    bin: ["binlist", "seon-bin"],
    vin: ["vin", "intelbase-vin", "intelbase-bmw"],
  };

  const ids = map[scope];

  if (!ids) return null;

  const kindHint =
    scope === "steam"
      ? "steam"
      : scope === "discord" || scope === "discord-roblox" || scope === "fivem"
        ? "discord"
        : scope === "ip"
          ? "ip"
          : scope === "domain"
            ? "domain"
            : scope === "email"
              ? "email"
              : scope === "phone"
                ? "phone"
                : scope === "crypto"
                  ? "crypto"
                  : scope === "bin"
                    ? "bin"
                    : scope === "vin"
                      ? "vin"
                      : scope === "google-docs"
                        ? "url"
                        : scope === "hwid"
                          ? "hash"
                          : "username";

  return fetchBreachHubByIds(ids, query, kindHint, timeoutMs);
}

/** Discord ID → Roblox via BreachHub seeknow (preferred) + OathNet mirror. */
export async function fetchBreachHubDiscordToRoblox(
  discordId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  if (!isBreachHubEnabled()) return null;

  const cleaned = discordId.trim();

  if (!cleaned || !DISCORD_ID_RE.test(cleaned)) return null;

  const specialty = await fetchBreachHubSpecialty(
    "discord-roblox",
    cleaned,
    timeoutMs,
  );

  if (specialty && specialty.results.length > 0) {
    const first = specialty.results[0];

    if (first && typeof first === "object" && !Array.isArray(first)) {
      return { ...(first as Record<string, unknown>), discord_id: cleaned };
    }
  }

  try {
    const data = await breachHubGet(
      "/api/seeknow/discord/to-roblox",
      { discord_id: cleaned },
      timeoutMs,
    );
    const rows = extractBreachHubRows(data);
    const first = rows[0];

    if (first) return { ...first, discord_id: cleaned };

    const username =
      asString(data.username) ||
      asString(data.roblox_username) ||
      asString(data.name);
    const userId =
      asString(data.userId) ||
      asString(data.user_id) ||
      asString(data.roblox_id);
    const profileUrl =
      asString(data.profileUrl) ||
      asString(data.profile_url) ||
      (userId ? `https://www.roblox.com/users/${userId}/profile` : "");

    if (!username && !userId && !profileUrl) return null;

    return {
      ...(username ? { username } : {}),
      ...(userId ? { userId } : {}),
      ...(profileUrl ? { profileUrl } : {}),
      discord_id: cleaned,
    };
  } catch {
    return null;
  }
}

export type StealerArchiveEntry = {
  logId: string;
  label?: string;
  machineId?: string;
  os?: string;
  date?: string;
  malware?: string;
  country?: string;
  credentials?: Array<{
    site?: string;
    username?: string;
    password?: string;
    date?: string;
  }>;
  summary?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  cookies?: unknown[];
  files?: StealerFileNode[];
};

export type StealerFileNode = {
  id?: string;
  name: string;
  type: "folder" | "file";
  count?: number;
  children?: StealerFileNode[];
  path?: string;
};

function asLogId(record: Record<string, unknown>): string {
  return (
    asString(record.log_id) ||
    asString(record.logId) ||
    asString(record.id) ||
    asString(record.machine_id) ||
    asString(record.machineId) ||
    asString(record.hwid) ||
    ""
  );
}

function normalizeCredentialRows(
  list: unknown[],
): NonNullable<StealerArchiveEntry["credentials"]> {
  const out: NonNullable<StealerArchiveEntry["credentials"]> = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const site =
      asString(row.url) ||
      asString(row.site) ||
      asString(row.domain) ||
      asString(row.host);
    const username =
      asString(row.username) ||
      asString(row.login) ||
      asString(row.email) ||
      asString(row.user);
    const password =
      asString(row.password) || asString(row.pass) || asString(row.secret);
    const date =
      asString(row.date) ||
      asString(row.added_at) ||
      asString(row.indexed_at) ||
      asString(row.timestamp);

    if (!site && !username && !password) continue;
    out.push({
      ...(site ? { site } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(date ? { date } : {}),
    });
  }

  return out;
}

function normalizeFileTree(input: unknown): StealerFileNode[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((item): StealerFileNode | null => {
        if (typeof item === "string") {
          return { name: item, type: item.includes(".") ? "file" : "folder" };
        }
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const node = item as Record<string, unknown>;
        const name =
          asString(node.name) ||
          asString(node.filename) ||
          asString(node.path) ||
          asString(node.id);
        if (!name) return null;
        const children = normalizeFileTree(
          node.children ?? node.files ?? node.entries ?? node.items,
        );
        const isFolder =
          children.length > 0 ||
          asString(node.type).toLowerCase() === "folder" ||
          asString(node.kind).toLowerCase() === "dir" ||
          Boolean(node.is_dir || node.isDir);
        const count =
          typeof node.count === "number"
            ? node.count
            : typeof node.items === "number"
              ? node.items
              : children.length || undefined;

        return {
          name,
          type: isFolder ? "folder" : "file",
          ...(asString(node.id) ? { id: asString(node.id) } : {}),
          ...(asString(node.path) ? { path: asString(node.path) } : {}),
          ...(count !== undefined ? { count } : {}),
          ...(children.length ? { children } : {}),
        };
      })
      .filter((n): n is StealerFileNode => Boolean(n));
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    if (Array.isArray(obj.tree)) return normalizeFileTree(obj.tree);
    if (Array.isArray(obj.files)) return normalizeFileTree(obj.files);
    if (Array.isArray(obj.manifest)) return normalizeFileTree(obj.manifest);

    // Flat map of folder → files
    const nodes: StealerFileNode[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        const children = normalizeFileTree(value);

        nodes.push({
          name: key,
          type: "folder",
          count: children.length,
          children,
        });
      } else if (value && typeof value === "object") {
        const children = normalizeFileTree(value);

        nodes.push({
          name: key,
          type: children.length ? "folder" : "file",
          ...(children.length
            ? { count: children.length, children }
            : {}),
        });
      }
    }

    return nodes;
  }

  return [];
}

export function extractStealerArchives(
  payload: unknown,
): StealerArchiveEntry[] {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const lists: unknown[] = [];

  for (const key of ["logs", "victims", "archives", "devices", "results"]) {
    if (Array.isArray(data[key])) lists.push(...(data[key] as unknown[]));
  }

  if (lists.length === 0 && Array.isArray(payload)) {
    lists.push(...payload);
  }

  const archives: StealerArchiveEntry[] = [];
  const seen = new Set<string>();

  for (const item of lists) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const logId = asLogId(row);

    if (!logId || seen.has(logId)) continue;
    seen.add(logId);

    const creds = Array.isArray(row.credentials)
      ? normalizeCredentialRows(row.credentials)
      : undefined;
    const files = normalizeFileTree(
      row.files ?? row.tree ?? row.manifest ?? row.file_tree,
    );

    archives.push({
      logId,
      label: asString(row.machine_id) || asString(row.label) || undefined,
      machineId: asString(row.machine_id) || asString(row.machineId) || undefined,
      os: asString(row.os) || undefined,
      date: asString(row.date) || asString(row.indexed_at) || undefined,
      malware: asString(row.malware) || asString(row.stealer) || undefined,
      country: asString(row.country) || undefined,
      ...(creds?.length ? { credentials: creds } : {}),
      ...(files.length ? { files } : {}),
      ...(row.summary && typeof row.summary === "object"
        ? { summary: row.summary as Record<string, unknown> }
        : {}),
      ...(row.properties && typeof row.properties === "object"
        ? { properties: row.properties as Record<string, unknown> }
        : {}),
      ...(Array.isArray(row.cookies) ? { cookies: row.cookies } : {}),
    });
  }

  return archives;
}

export async function fetchBreachHubStealerVictims(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<StealerArchiveEntry[]> {
  if (!isBreachHubEnabled()) return [];

  try {
    const data = await breachHubGet(
      "/api/oathnet/victims",
      { query: query.trim() },
      timeoutMs,
    );

    return extractStealerArchives(data);
  } catch {
    return [];
  }
}

export async function fetchBreachHubVictimManifest(
  logId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<StealerArchiveEntry | null> {
  if (!isBreachHubEnabled() || !logId.trim()) return null;

  try {
    const data = await breachHubGet(
      "/api/oathnet/victims/:log_id",
      {},
      timeoutMs,
      { log_id: logId.trim() },
    );
    const archives = extractStealerArchives(data);

    if (archives[0]) return { ...archives[0], logId: logId.trim() };

    const files = normalizeFileTree(
      data.files ?? data.tree ?? data.manifest ?? data.file_tree ?? data,
    );

    return {
      logId: logId.trim(),
      ...(files.length ? { files } : {}),
      summary:
        data.summary && typeof data.summary === "object"
          ? (data.summary as Record<string, unknown>)
          : stripMetaFields(data),
      properties:
        data.properties && typeof data.properties === "object"
          ? (data.properties as Record<string, unknown>)
          : undefined,
      cookies: Array.isArray(data.cookies) ? data.cookies : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchBreachHubVictimArchiveUrl(
  logId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ downloadUrl?: string; payload?: Record<string, unknown> } | null> {
  if (!isBreachHubEnabled() || !logId.trim()) return null;

  try {
    const data = await breachHubGet(
      "/api/oathnet/victims/:log_id/archive",
      {},
      timeoutMs,
      { log_id: logId.trim() },
    );
    const downloadUrl =
      asString(data.download_url) ||
      asString(data.url) ||
      asString(data.archive_url) ||
      asString(data.link);

    return {
      ...(downloadUrl ? { downloadUrl } : {}),
      payload: stripMetaFields(data),
    };
  } catch {
    return null;
  }
}

export function breachHubRowsToCredentials(
  results: unknown[],
): CombCredential[] {
  const credentials: CombCredential[] = [];
  const seen = new Set<string>();

  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const identifier =
      asString(record.email) ||
      asString(record.username) ||
      asString(record.phone) ||
      asString(record.ip) ||
      asString(record.name) ||
      asString(record.full_name);
    const secret =
      asString(record.password) ||
      asString(record.pass) ||
      asString(record.hash) ||
      asString(record.password_hash) ||
      asString(record.encrypted_password);

    if (!identifier && !secret) continue;
    if (identifier && isBrandPlaceholderValue(identifier)) continue;
    if (secret && isBrandPlaceholderValue(secret)) continue;

    const id = identifier || "(unknown)";

    if (isBrandPlaceholderValue(id)) continue;

    const key = `${id.toLowerCase()}\0${secret}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const breachSource =
      asString(record.database) ||
      asString(record.dbname) ||
      asString(record.origin) ||
      asString(record.title);
    const raw = secret ? `${id}:${secret}` : id;

    credentials.push({
      identifier: id,
      secret,
      raw: breachSource ? `${breachSource} · ${raw}` : raw,
    });
  }

  return credentials;
}

export async function fetchBreachHubSteam(
  steamId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  return fetchBreachHubSpecialty("steam", steamId, timeoutMs);
}

export async function fetchBreachHubCrypto(
  address: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  if (!isBreachHubEnabled()) return null;

  const category = ETH_RE.test(address)
    ? "eth"
    : BTC_RE.test(address)
      ? "btc"
      : null;

  if (!category) return null;

  try {
    const data = await breachHubGet(
      "/api/breachhub/crypto",
      { category, term: address.trim() },
      timeoutMs,
    );

    return stripMetaFields(data);
  } catch {
    return null;
  }
}

export async function fetchBreachHubDiscord(
  discordId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  return fetchBreachHubSpecialty("discord", discordId, timeoutMs);
}

export async function fetchBreachHubRaw(
  endpointId: string,
  params: Record<string, string>,
  pathParams: Record<string, string> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  if (!isBreachHubEnabled()) return null;

  const endpoint = BREACHHUB_ENDPOINTS.find((item) => item.id === endpointId);

  if (!endpoint) return null;

  try {
    const data = await breachHubGet(
      endpoint.path,
      params,
      timeoutMs,
      pathParams,
    );

    return stripMetaFields(data);
  } catch {
    return null;
  }
}

export async function probeBreachHub(): Promise<boolean> {
  if (!isBreachHubEnabled()) return false;

  try {
    const data = await breachHubGet("/api/status", {}, 8_000);

    return Boolean(data.summary || data.sources || data.status || data.success);
  } catch {
    return false;
  }
}
