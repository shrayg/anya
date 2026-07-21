/**
 * BreachHub.org unified intelligence client — full coverage of the public API.
 *
 * Docs: https://breachhub.org/docs · OpenAPI: https://breachhub.org/openapi.json
 * (Scalar also loads https://breachhub.org/api/openapi — fuller path catalog.)
 * Auth: query param `key` (ApiKeyAuth). Disable with BREACHHUB_ENABLED=false.
 *
 * Vendor policy (lib/provider-dedupe.ts): BreachHub is primary for mirrored
 * vendors; CSINT / direct clients are sequential fallbacks — never parallel
 * double-hits. IntelBase * mirrors of direct BH catalog ids are always skipped.
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
  intelResultFingerprint,
  scrubIntelRecord,
  scrubIntelResults,
  filterIntelResultsForQuery,
} from "@/lib/intel-record";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import {
  providerCacheKey,
  withProviderCache,
} from "@/lib/provider-result-cache";
import {
  filterBreachHubEndpointIds,
  filterBreachHubEndpoints,
  shouldSkipBreachHubEndpoint,
} from "@/lib/provider-dedupe";
import { recordProviderRequest } from "@/lib/provider-request-log";

const BREACHHUB_BASE = "https://breachhub.org";
const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
/** Soft memory ceiling across a single upstream payload (not a UX page size). */
const MAX_ROWS = 250_000;
/** Per nested list / source bucket — keep large email hit sets intact. */
const MAX_ROWS_PER_SOURCE = 250_000;
/** Identical path+params within one process — avoids duplicate stealer/victim hits. */
const BREACHHUB_GET_CACHE_TTL_MS = 45_000;
/** Seeknow can be slow; give it enough time to return large pages. */
const SEEKNOW_TIMEOUT_MS = 14_000;
const FLAKY_VENDOR_TIMEOUT_MS = 16_000;

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
    id: "intelvault-breaches",
    path: "/api/intelvault/breaches",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "phone", "ip", "domain", "password"],
    buildParams: (query, kind): Record<string, string> | null => {
      if (kind === "email") return { email: query };
      if (kind === "username") return { username: query };
      if (kind === "phone") return { phone: query };
      if (kind === "ip") return { ip: query };
      if (kind === "domain") return { domain: query };
      if (kind === "password") return { password: query };

      return null;
    },
  },
  {
    id: "intelvault-stealer-logs",
    path: "/api/intelvault/stealer-logs",
    section: "data_breach",
    modes: ["additive", "specialty"],
    kinds: ["email", "username", "domain", "ip"],
    buildParams: (query): Record<string, string> | null =>
      query.trim().length >= 4 ? q(query) : null,
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
    id: "cordcat-user",
    path: "/api/cordcat/user",
    section: "data_breach",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ id: query }),
  },
  {
    id: "intelx",
    path: "/api/intelx",
    section: "data_breach",
    modes: ["specialty", "followup"],
    // Storage/System IDs: UUID, 32-hex System ID, or long Storage ID hash.
    kinds: ["hash"],
    buildParams: (query): Record<string, string> | null => {
      const trimmed = query.trim();
      const hex = trimmed.replace(/[^a-f0-9]/gi, "");

      if (
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          trimmed,
        )
      ) {
        return { system_id: trimmed.toLowerCase() };
      }
      if (/^[a-f0-9]{32}$/i.test(hex)) {
        const uuid = [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20),
        ]
          .join("-")
          .toLowerCase();

        return { system_id: uuid };
      }
      // OpenAPI: Storage ID mode requires storage_id + bucket.
      if (/^[a-f0-9]{40,256}$/i.test(hex)) {
        return { storage_id: hex.toLowerCase(), bucket: "leaks.public" };
      }

      return null;
    },
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
    modes: ["additive", "specialty"],
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
      limit: "250000",
    }),
  },
  {
    id: "seeknow-stealer",
    // Status inventory supports type=stealer on /api/seeknow/search.
    path: "/api/seeknow/search",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "domain"],
    buildParams: (query) => ({ query, type: "stealer", limit: "250000" }),
  },
  {
    id: "seeknow-stealer-legacy",
    // Status inventory still lists /api/seeknow/stealer (may 404 on some plans).
    path: "/api/seeknow/stealer",
    section: "data_breach",
    modes: ["additive"],
    kinds: ["email", "username", "domain"],
    buildParams: (query) => ({ query, limit: "250000" }),
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
  // Live status inventory exposes richer HudsonRock paths; soft-fail if absent.
  {
    id: "hudsonrock",
    path: "/api/hudsonrock",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "hudsonrock-login-emails",
    path: "/api/hudsonrock/search-by-login/emails",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["email"],
    buildParams: (query) => ({ email: query }),
  },
  {
    id: "hudsonrock-domain",
    path: "/api/hudsonrock/search-by-domain",
    section: "intelligence_platform",
    modes: ["additive", "specialty"],
    kinds: ["domain"],
    buildParams: (query) => ({ domain: query }),
  },
  {
    id: "hudsonrock-ip",
    path: "/api/hudsonrock/search-by-ip",
    section: "intelligence_platform",
    modes: ["additive", "specialty"],
    kinds: ["ip"],
    buildParams: (query) => ({ ip: query }),
  },
  {
    id: "hudsonrock-usernames",
    path: "/api/hudsonrock/search-by-login/usernames",
    section: "intelligence_platform",
    modes: ["additive"],
    kinds: ["username"],
    buildParams: (query) => ({ username: query }),
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

  // ─── 3. Social & OSINT — OathNet (full OpenAPI /api/oathnet/*) ───────
  // Docs: breach, stealer, stealer-subdomain, extract-subdomain, victims(+log/
  // files/archive), discord-userinfo, discord-username-history,
  // discord-to-roblox, steam, xbox, roblox-userinfo, mc-history, ip-info,
  // holehe, ghunt. Never skip via provider-dedupe (not an IntelBase mirror).
  {
    id: "oathnet-breach",
    path: "/api/oathnet/breach",
    section: "social_osint",
    modes: ["additive", "specialty"],
    kinds: ["email", "username", "domain", "phone"],
    buildParams: (query) => q(query),
  },
  {
    id: "oathnet-stealer",
    path: "/api/oathnet/stealer",
    section: "social_osint",
    modes: ["additive", "specialty"],
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
    modes: ["additive", "specialty"],
    kinds: ["email", "domain", "username"],
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
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => ({ discord_id: query }),
  },
  {
    id: "oathnet-discord-roblox",
    path: "/api/oathnet/discord-to-roblox",
    section: "social_osint",
    modes: ["specialty", "additive"],
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
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => ({ xbl_id: query }),
  },
  {
    id: "oathnet-roblox",
    path: "/api/oathnet/roblox-userinfo",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      if (!cleaned) return null;

      // OpenAPI: provide either user_id or username.
      return /^\d+$/.test(cleaned)
        ? { user_id: cleaned }
        : { username: cleaned };
    },
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
    id: "room101-search-legacy",
    path: "/api/room101/search",
    section: "social_osint",
    modes: ["specialty", "additive"],
    kinds: ["username", "name", "email"],
    buildParams: (query) => ({ terms: query }),
  },
  {
    id: "room101-search",
    path: "/api/room101/v2/search",
    section: "social_osint",
    modes: ["specialty", "additive"],
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
    id: "seekria-discord-profile",
    path: "/api/seekria/discord-profile",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-discord-to-rat",
    path: "/api/seekria/discord-to-rat",
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
    id: "seekria-minecraft-osint",
    path: "/api/seekria/minecraft-osint",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-name-history",
    path: "/api/seekria/name-history",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-minecraft-texture",
    path: "/api/seekria/minecraft-texture",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-laby-stats",
    path: "/api/seekria/laby-stats",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "seekria-fivem",
    path: "/api/seekria/fivem",
    section: "social_osint",
    modes: ["specialty"],
    kinds: ["discord", "username", "ip"],
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
    // OpenAPI accepts type=username | discord-id — also a Discord→Roblox path.
    kinds: ["username", "discord"],
    buildParams: (query, kind): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      if (!cleaned) return null;

      if (kind === "discord" || DISCORD_ID_RE.test(cleaned)) {
        return { type: "discord-id", query: cleaned };
      }

      return { type: "username", query: cleaned };
    },
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
    buildParams: (query, kind): Record<string, string> | null => {
      if (kind === "ip") return { module: "ip-info", query };
      if (kind === "domain") return { module: "domain", query };
      if (kind === "username") return { module: "username", query };
      if (kind === "phone") return { module: "hlr", query };
      if (kind === "name") {
        const parts = query.trim().split(/\s+/);

        if (parts.length >= 2) {
          return {
            module: "npd",
            firstname: parts[0]!,
            lastname: parts.slice(1).join(" "),
          };
        }

        return { module: "npd", lastname: query };
      }

      return { module: "leaks", query };
    },
  },
  {
    id: "inf0sec-leaks",
    path: "/api/inf0sec",
    section: "specialized_tools",
    modes: ["additive"],
    kinds: ["email", "username", "domain", "phone", "auto"],
    buildParams: (query) => ({ module: "leaks", query }),
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
    id: "datavoid-roblox",
    path: "/api/datavoid/roblox",
    section: "specialized_tools",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query) => q(query),
  },
  {
    id: "datavoid-twitter",
    path: "/api/datavoid/twitter",
    section: "specialized_tools",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      return cleaned ? { q: cleaned } : null;
    },
  },
  {
    id: "datavoid-discord",
    path: "/api/datavoid/discord",
    section: "specialized_tools",
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => ({ id: query }),
  },
  {
    id: "datavoid-fivem",
    path: "/api/datavoid/fivem",
    section: "specialized_tools",
    modes: ["specialty"],
    kinds: ["discord", "username", "ip"],
    buildParams: (query) => q(query),
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
    id: "discord-user",
    path: "/api/discord/user",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["discord"],
    buildParams: (query) => q(query),
  },
  {
    id: "discord-history",
    path: "/api/discord/history",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ id: query }),
  },
  {
    id: "discord-snowflake",
    path: "/api/discord/snowflake",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["discord"],
    buildParams: (query) => ({ id: query }),
  },
  {
    id: "telegram-username",
    path: "/api/telegram/username",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      if (!cleaned || /^\d+$/.test(cleaned)) return null;

      return { query: cleaned, mode: "username" };
    },
  },
  {
    id: "telegram-id",
    path: "/api/telegram/id",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      // Prefer numeric Telegram IDs; still accept handles if username path skipped.
      if (!cleaned) return null;

      return { query: cleaned };
    },
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
    id: "notalivex-tg-username",
    path: "/api/notalivex/tg/username",
    section: "user_lookup",
    modes: ["specialty", "additive"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      return cleaned && !/^\d+$/.test(cleaned) ? q(cleaned) : null;
    },
  },
  {
    id: "notalivex-tg-id",
    path: "/api/notalivex/tg/id",
    section: "user_lookup",
    modes: ["specialty"],
    kinds: ["username"],
    buildParams: (query): Record<string, string> | null => {
      const cleaned = query.trim().replace(/^@/, "");

      return cleaned && /^\d+$/.test(cleaned) ? q(cleaned) : null;
    },
  },
  {
    id: "notalivex-tg-phone",
    path: "/api/notalivex/tg/telefono",
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
  const cacheKey = providerCacheKey("breachhub", {
    path: resolved,
    ...params,
  });

  return withProviderCache(
    cacheKey,
    BREACHHUB_GET_CACHE_TTL_MS,
    async () => {
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
      let logged = false;

      const logRequest = (
        ok: boolean,
        opts?: { statusCode?: number; error?: string },
      ) => {
        if (logged) return;
        logged = true;
        recordProviderRequest({
          gateway: "breachhub",
          path: resolved,
          method: "GET",
          ok,
          latencyMs: Date.now() - started,
          statusCode: opts?.statusCode,
          error: opts?.error,
        });
      };

      try {
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
          const errMsg = !res.ok
            ? sanitizeBreachHubError(`HTTP ${res.status}`)
            : publicSearchError("Invalid response from intelligence index.");

          logRequest(false, { statusCode: res.status, error: errMsg });
          throw new Error(errMsg);
        }

        if (!res.ok) {
          const msg =
            (typeof data.message === "string" && data.message) ||
            (typeof data.error === "string" && data.error) ||
            `HTTP ${res.status}`;
          const errMsg = sanitizeBreachHubError(msg);

          logRequest(false, { statusCode: res.status, error: errMsg });
          throw new Error(errMsg);
        }

        if (data.success === false) {
          const msg =
            (typeof data.message === "string" && data.message) ||
            (typeof data.error === "string" && data.error) ||
            "Search failed";
          const errMsg = sanitizeBreachHubError(msg);

          logRequest(false, { statusCode: res.status, error: errMsg });
          throw new Error(errMsg);
        }

        logRequest(true, { statusCode: res.status });

        return data;
      } catch (err) {
        logRequest(false, {
          error: err instanceof Error ? err.message : "Request failed",
        });
        throw err;
      }
    },
    {
      // Never poison the short TTL cache with empty victim trees or empty search hits.
      shouldCache: (data) => {
        if (isVictimFileTreePath(resolved)) {
          return breachHubPayloadHasFileTree(data);
        }

        return breachHubPayloadHasSearchHits(data);
      },
    },
  );
}

/** Per-log manifest / machine treeview paths — empty bodies must not be cached. */
function isVictimFileTreePath(path: string): boolean {
  const lower = path.toLowerCase();

  return (
    /\/oathnet\/victims\/[^/?]+$/i.test(lower) ||
    /\/files\/treeview$/i.test(lower) ||
    /\/machine-viewer\/machines\/[^/]+\/info$/i.test(lower)
  );
}

/** True when a BreachHub JSON body has at least one extractable search row. */
function breachHubPayloadHasSearchHits(data: Record<string, unknown>): boolean {
  return extractBreachHubRows(data).length > 0;
}

function breachHubPayloadHasFileTree(data: Record<string, unknown>): boolean {
  const hasNode = (value: unknown): boolean => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;

      return Boolean(
        obj.victim_tree ||
          obj.tree ||
          obj.file_tree ||
          obj.manifest ||
          (Array.isArray(obj.files) && obj.files.length > 0) ||
          (Array.isArray(obj.children) && obj.children.length > 0) ||
          asString(obj.name) ||
          asString(obj.type),
      );
    }

    return false;
  };

  if (
    hasNode(data.victim_tree) ||
    hasNode(data.tree) ||
    hasNode(data.file_tree) ||
    hasNode(data.manifest) ||
    hasNode(data.files) ||
    hasNode(data.children)
  ) {
    return true;
  }

  if (data.data && typeof data.data === "object") {
    if (hasNode(data.data)) return true;
    if (!Array.isArray(data.data)) {
      const nested = data.data as Record<string, unknown>;

      if (
        hasNode(nested.victim_tree) ||
        hasNode(nested.tree) ||
        hasNode(nested.files) ||
        hasNode(nested.file_tree) ||
        hasNode(nested.manifest)
      ) {
        return true;
      }
    }
  }

  for (const key of ["logs", "victims", "machines", "results", "items"] as const) {
    const list = data[key];

    if (!Array.isArray(list)) continue;

    for (const row of list) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;

      if (
        hasNode(record.victim_tree) ||
        hasNode(record.tree) ||
        hasNode(record.files) ||
        hasNode(record.file_tree) ||
        hasNode(record.manifest)
      ) {
        return true;
      }
    }
  }

  return false;
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

  // OsintCat machine-viewer / OathNet victims often use `logs` / `victims` /
  // `machines`, or the standard envelope `{ data: { items: [...] } }`.
  if (rows.length === 0) {
    for (const key of [
      "logs",
      "victims",
      "archives",
      "devices",
      "machines",
      "items",
    ]) {
      if (Array.isArray(data[key])) {
        pushLimited(data[key] as unknown[]);
        break;
      }
    }
  }

  if (rows.length === 0 && data.data && typeof data.data === "object") {
    if (Array.isArray(data.data)) {
      pushLimited(data.data);
    } else {
      const nested = data.data as Record<string, unknown>;

      for (const key of [
        "items",
        "results",
        "logs",
        "victims",
        "archives",
        "devices",
        "machines",
      ]) {
        if (Array.isArray(nested[key])) {
          pushLimited(nested[key] as unknown[]);
          break;
        }
      }
    }
  }

  if (rows.length === 0 && Array.isArray(data.services)) {
    pushLimited(data.services);
  }

  if (rows.length === 0) {
    const profile = data.profile;
    const userInfo = data.user_info ?? data.userInfo;

    if (profile && typeof profile === "object" && !Array.isArray(profile)) {
      pushRecord(rows, {
        ...(profile as Record<string, unknown>),
        ...(asString(data.steamid64)
          ? { steamid64: asString(data.steamid64) }
          : {}),
        ...(asString(data.wallet) ? { wallet: asString(data.wallet) } : {}),
      });
    } else if (
      userInfo &&
      typeof userInfo === "object" &&
      !Array.isArray(userInfo)
    ) {
      // OsintCat / stalker-style envelopes: { user_info: { …, mutual_guilds } }
      pushRecord(rows, {
        ...(userInfo as Record<string, unknown>),
        ...(Array.isArray(data.mutual_guilds)
          ? { mutual_guilds: data.mutual_guilds }
          : {}),
        ...(Array.isArray(data.connected_accounts)
          ? { connected_accounts: data.connected_accounts }
          : {}),
      });
    } else if (
      asString(data.wallet) ||
      asString(data.steamid64) ||
      asString(data.balance) ||
      Array.isArray(data.sources) ||
      // Flat Discord / Xbox / social profile payloads (no results[] wrapper).
      asString(data.username) ||
      asString(data.global_name) ||
      asString(data.globalName) ||
      asString(data.gamertag) ||
      typeof data.mutual_servers === "number" ||
      Array.isArray(data.mutual_guilds) ||
      Array.isArray(data.connected_accounts) ||
      Array.isArray(data.guilds) ||
      Array.isArray(data.servers)
    ) {
      pushRecord(rows, stripMetaFields(data));
    }
  }

  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];

  for (const row of rows) {
    const key = intelResultFingerprint(row);

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= MAX_ROWS) break;
  }

  return deduped;
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
  query?: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (query?.trim()) {
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  }

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

    return toSanitized(data, reportedCount(data), query);
  } catch {
    return null;
  }
}

type FanOutOptions = {
  /** Stop once this many rows are collected (still waits in-flight briefly). */
  minResults?: number;
  /** Hard wall-clock budget for the whole fan-out. */
  budgetMs?: number;
  /** Cap parallel upstream calls. */
  concurrency?: number;
};

function endpointCallTimeoutMs(
  endpoint: BreachHubEndpointDef,
  baseTimeoutMs: number,
): number {
  const id = endpoint.id.toLowerCase();
  const path = endpoint.path.toLowerCase();

  if (id.startsWith("seeknow-") || path.includes("/seeknow/")) {
    return Math.min(baseTimeoutMs, SEEKNOW_TIMEOUT_MS);
  }

  if (
    id.includes("hudsonrock") ||
    id.includes("datavoid") ||
    id.includes("leakosint") ||
    id.includes("snusbase") ||
    id.includes("infodra")
  ) {
    return Math.min(baseTimeoutMs, FLAKY_VENDOR_TIMEOUT_MS);
  }

  return baseTimeoutMs;
}

function endpointRequestKey(
  endpoint: BreachHubEndpointDef,
  query: string,
  kind: BreachHubQueryKind,
): string | null {
  const params = endpoint.buildParams(query, kind);

  if (!params) return null;

  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ""}`)
    .join("&");

  return `${endpoint.path}?${sorted}`;
}

/**
 * Worker-pool fan-out: starts the next endpoint as soon as a slot frees
 * (unlike batch-wait), abandons the queue when the wall budget hits, and
 * skips duplicate path+params within the same request.
 */
async function fanOutEndpoints(
  endpoints: BreachHubEndpointDef[],
  query: string,
  kind: BreachHubQueryKind,
  timeoutMs: number,
  options?: FanOutOptions,
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled() || endpoints.length === 0) return null;

  const trimmed = query.trim();

  if (!trimmed) return null;

  const minResults = options?.minResults ?? 0;
  const budgetMs = options?.budgetMs ?? timeoutMs;
  const concurrency = Math.max(1, options?.concurrency ?? 8);
  const started = Date.now();
  const parts: SanitizedBreachResponse[] = [];
  let totalRows = 0;
  let stopQueue = false;

  const seenKeys = new Set<string>();
  const queue: BreachHubEndpointDef[] = [];

  for (const endpoint of endpoints) {
    if (shouldSkipBreachHubEndpoint(endpoint.id)) continue;

    const key = endpointRequestKey(endpoint, trimmed, kind);

    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    queue.push(endpoint);
  }

  if (queue.length === 0) return null;

  let next = 0;

  const runOne = async (endpoint: BreachHubEndpointDef) => {
    const remaining = budgetMs - (Date.now() - started);

    if (remaining < 1_500) {
      stopQueue = true;

      return;
    }

    const perCall = Math.min(
      endpointCallTimeoutMs(endpoint, timeoutMs),
      remaining,
    );
    const value = await fetchEndpointSafe(endpoint, trimmed, kind, perCall);

    if (value && value.count > 0) {
      parts.push(value);
      totalRows += value.results.length;
      if (minResults > 0 && totalRows >= minResults) {
        stopQueue = true;
      }
    }
  };

  async function worker() {
    for (;;) {
      if (stopQueue || Date.now() - started >= budgetMs) {
        stopQueue = true;

        return;
      }

      const index = next;

      next += 1;
      if (index >= queue.length) return;

      await runOne(queue[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker(),
  );

  await Promise.all(workers);

  if (parts.length === 0) return null;

  const merged = mergeSanitizedResponses(...parts);

  return merged.count > 0 ? merged : null;
}

function additiveForKind(kind: BreachHubQueryKind): BreachHubEndpointDef[] {
  // Drop BreachHub mirrors of configured direct CSINT / OsintCat / BreachVIP / CordCat.
  return filterBreachHubEndpoints(
    BREACHHUB_ENDPOINTS.filter(
      (endpoint) =>
        endpoint.modes.includes("additive") &&
        (endpoint.kinds.includes(kind) ||
          (kind !== "auto" && endpoint.kinds.includes("auto"))),
    ),
  );
}

/**
 * Pure infection / stealer-log indexes. These are excluded from breach-only
 * fan-out so Snusbase / LeakOsint / etc. stay in the breach path.
 *
 * All pure stealer sources run in the primary wave so a short budget cannot
 * starve Seeknow / DataVoid / Inf0sec / HudsonRock login pivots.
 */
const STEALER_ONLY_PRIMARY_IDS = [
  "oathnet-victims",
  "osintcat-machine-search",
  "oathnet-stealer",
  "wentyn",
  "hudsonrock",
  "hudsonrock-login-emails",
  "hudsonrock-usernames",
  "hudsonrock-domain",
  "hudsonrock-ip",
  "intelbase-intelvault-stealer",
  "seeknow-stealer",
  "seeknow-stealer-legacy",
  "datavoid-stealer",
  "intelvault-stealer-logs",
  "seekria-discord-to-rat",
  "inf0sec-leaks",
  "oathnet-stealer-subdomain",
] as const;

const STEALER_ONLY_SECONDARY_IDS = [] as const;

/**
 * Breach indexes also useful during stealer searches for credential coverage.
 * Must NOT be excluded from breach-only fan-out.
 */
const STEALER_BREACH_OVERLAP_IDS = [
  "breachhub-search",
  "oathnet-breach",
  "leakosint",
  "leakcheck-v2",
  "leaksight",
  "intelvault",
  "intelvault-breaches",
  "hackcheck",
  "infodra",
  "cypherdynamics",
  "osintbat-email-breach",
  "osintcat-database",
  "snusbase",
  "snusbase-combo",
  "seekria-email-breach",
  "inf0sec",
  "seeknow-search",
  "xosint",
  "akula",
] as const;

const STEALER_ONLY_ID_SET = new Set<string>([
  ...STEALER_ONLY_PRIMARY_IDS,
  ...STEALER_ONLY_SECONDARY_IDS,
]);

function isPureStealerEndpoint(endpoint: BreachHubEndpointDef): boolean {
  if (STEALER_ONLY_ID_SET.has(endpoint.id)) return true;

  const id = endpoint.id.toLowerCase();
  const path = endpoint.path.toLowerCase();

  return (
    id.includes("stealer") ||
    path.includes("/stealer") ||
    id.includes("hudsonrock") ||
    path.includes("/hudsonrock") ||
    id.includes("victims") ||
    path.includes("/victims") ||
    id.includes("machine-search") ||
    path.includes("machine-viewer/search") ||
    id === "wentyn" ||
    path.includes("/wentyn") ||
    id === "inf0sec-leaks"
  );
}

function matchesStealerKind(
  endpoint: BreachHubEndpointDef,
  kind: BreachHubQueryKind,
): boolean {
  if (
    endpoint.id === "oathnet-stealer-subdomain" &&
    kind !== "domain"
  ) {
    return false;
  }

  return (
    endpoint.kinds.includes(kind) ||
    (kind !== "auto" && endpoint.kinds.includes("auto")) ||
    (kind === "email" &&
      (endpoint.kinds.includes("username") ||
        endpoint.kinds.includes("email")))
  );
}

function stealerEndpointsByTier(
  kind: BreachHubQueryKind,
): { primary: BreachHubEndpointDef[]; secondary: BreachHubEndpointDef[] } {
  const byId = new Map(BREACHHUB_ENDPOINTS.map((e) => [e.id, e]));

  const pick = (ids: readonly string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((endpoint): endpoint is BreachHubEndpointDef =>
        Boolean(
          endpoint &&
            endpoint.modes.includes("additive") &&
            matchesStealerKind(endpoint, kind),
        ),
      );

  // Also pull any newly catalogued pure-stealer additive endpoints.
  const listed = new Set<string>([
    ...STEALER_ONLY_PRIMARY_IDS,
    ...STEALER_ONLY_SECONDARY_IDS,
    ...STEALER_BREACH_OVERLAP_IDS,
  ]);
  const discovered = BREACHHUB_ENDPOINTS.filter(
    (endpoint) =>
      !listed.has(endpoint.id) &&
      endpoint.modes.includes("additive") &&
      isPureStealerEndpoint(endpoint) &&
      matchesStealerKind(endpoint, kind),
  );

  // Pure stealer + discovered infection indexes first; breach overlaps second.
  return {
    primary: filterBreachHubEndpoints([
      ...pick(STEALER_ONLY_PRIMARY_IDS),
      ...discovered,
    ]),
    secondary: filterBreachHubEndpoints([
      ...pick(STEALER_ONLY_SECONDARY_IDS),
      ...pick(STEALER_BREACH_OVERLAP_IDS),
    ]),
  };
}

/** Full additive fan-out across Data Breach + overlapping Social/Intel indexes. */
export async function fetchBreachHubAdditiveBreachSearch(
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const kind = detectBreachHubQueryKind(query, kindHint);
  // Keep pure stealer/infection indexes out — but never exclude Snusbase,
  // LeakOsint, LeakCheck, IntelVault, etc. (those used to sit on the stealer
  // secondary list and starved breach searches).
  const endpoints = additiveForKind(kind).filter(
    (endpoint) => !isPureStealerEndpoint(endpoint),
  );

  // Coverage-first: give the full Data Breach catalog enough wall-clock to
  // finish multiple concurrency waves. Do not early-exit after a few hits —
  // that silently truncated large breach sets under short budgets.
  const perCall = Math.min(Math.max(timeoutMs, 18_000), 28_000);
  const budget = Math.min(Math.max(timeoutMs, 32_000), 42_000);

  return fanOutEndpoints(endpoints, query, kind, perCall, {
    minResults: 0,
    budgetMs: budget,
    concurrency: 10,
  });
}

/** Stealer / infection indexes — primary then secondary in one shared budget. */
export async function fetchBreachHubAdditiveStealerSearch(
  query: string,
  kindHint?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const kind = detectBreachHubQueryKind(query, kindHint);
  const { primary, secondary } = stealerEndpointsByTier(kind);
  const budget = Math.min(Math.max(timeoutMs, 36_000), 48_000);
  const perCall = Math.min(Math.max(timeoutMs, 16_000), 28_000);

  // One worker pool: pure stealer sources first, then breach-overlap credential
  // indexes. minResults=0 keeps coverage — do not early-exit after a few hits.
  return fanOutEndpoints([...primary, ...secondary], query, kind, perCall, {
    minResults: 0,
    budgetMs: budget,
    concurrency: 12,
  });
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
  const idSet = new Set(filterBreachHubEndpointIds(ids));
  const endpoints = BREACHHUB_ENDPOINTS.filter((endpoint) =>
    idSet.has(endpoint.id),
  );

  // Specialty / by-ids: enough budget for full related catalog, large payloads.
  const perCall = Math.min(Math.max(timeoutMs, 16_000), 28_000);
  const budget = Math.min(Math.max(timeoutMs, 28_000), 42_000);

  return fanOutEndpoints(endpoints, query, kind, perCall, {
    minResults: 0,
    budgetMs: budget,
    concurrency: 12,
  });
}

/** Expand seed specialty IDs with every catalog endpoint matching the scope. */
function expandSpecialtyIds(scope: string, seed: string[]): string[] {
  // Discord→Roblox must NOT expand to every discord_* or roblox_* endpoint —
  // that starved the real to-roblox converters and returned unrelated profiles.
  if (scope === "discord-roblox") {
    const discovered = BREACHHUB_ENDPOINTS.filter((endpoint) => {
      if (
        !endpoint.modes.includes("specialty") &&
        !endpoint.modes.includes("additive")
      ) {
        return false;
      }

      const id = endpoint.id.toLowerCase();
      const path = endpoint.path.toLowerCase();

      return (
        id.includes("discord-roblox") ||
        id.includes("to-roblox") ||
        path.includes("discord-to-roblox") ||
        path.includes("/to-roblox") ||
        path.includes("discord/to-roblox") ||
        // IntelBase roblox accepts type=discord-id for the same pivot.
        id === "intelbase-roblox"
      );
    }).map((endpoint) => endpoint.id);

    return [...new Set([...seed, ...discovered])];
  }

  const tokens = scope
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  const extras =
    scope === "google-docs"
      ? ["google", "docs"]
      : scope === "minecraft"
        ? ["mc-history", "hypixel", "laby", "name-history", "minecraft-texture"]
        : scope === "twitter"
          ? ["twitter-osint"]
          : scope === "telegram"
            ? ["telegram"]
            : scope === "xbox"
              ? ["xbox", "xbl"]
              : [];
  const keys = [...new Set([...tokens, ...extras])];

  const discovered = BREACHHUB_ENDPOINTS.filter((endpoint) => {
    if (
      !endpoint.modes.includes("specialty") &&
      !endpoint.modes.includes("additive")
    ) {
      return false;
    }

    const id = endpoint.id.toLowerCase();
    const path = endpoint.path.toLowerCase();

    // Keep username Roblox lookups out of plain "roblox" discovery of
    // discord-to-roblox converters (those need a Discord snowflake).
    if (
      scope === "roblox" &&
      (id.includes("discord-roblox") ||
        id.includes("to-roblox") ||
        path.includes("discord-to-roblox") ||
        path.includes("/to-roblox"))
    ) {
      return false;
    }

    return keys.some(
      (key) =>
        id.includes(key) ||
        path.includes(`/${key}`) ||
        path.includes(`-${key}`) ||
        path.includes(`_${key}`),
    );
  }).map((endpoint) => endpoint.id);

  return [...new Set([...seed, ...discovered])];
}

export async function fetchBreachHubSpecialty(
  scope: string,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse | null> {
  const map: Record<string, string[]> = {
    steam: ["breachhub-steam", "oathnet-steam"],
    xbox: [
      "breachhub-xbox",
      "oathnet-xbox",
      "seeknow-xbox",
      "seeknow-social",
    ],
    roblox: [
      "nbrs-roblox",
      "seeknow-roblox",
      "oathnet-roblox",
      "seekria-roblox",
      "osintbat-roblox",
      "intelbase-roblox",
      "indicia-roblox",
      "datavoid-roblox",
    ],
    minecraft: [
      "oathnet-mc",
      "seekria-minecraft",
      "seekria-minecraft-osint",
      "seekria-name-history",
      "seekria-minecraft-texture",
      "seekria-laby-stats",
      "seeknow-minecraft",
      "osintbat-minecraft",
      "intelbase-minecraft",
      "seeknow-history",
    ],
    discord: [
      "seeknow-discord-user",
      "reconly",
      "discord-lookup",
      "discord-stalker",
      "discord-user",
      "discord-history",
      "discord-snowflake",
      "cordcat",
      "cordcat-user",
      "oathnet-discord-userinfo",
      "oathnet-discord-history",
      "seekria-discord",
      "seekria-discord-profile",
      "seekria-discord-to-rat",
      "osintbat-discord",
      "intelbase-discord",
      "intelfetch-discord",
      "indicia-discord",
      "datavoid-discord",
    ],
    "discord-roblox": [
      "seeknow-discord-roblox",
      "oathnet-discord-roblox",
      "intelbase-roblox",
    ],
    telegram: [
      "telegram-username",
      "telegram-id",
      "telegram-phone",
      "notalivex-tg-username",
      "notalivex-tg-id",
      "notalivex-tg-phone",
    ],
    snapchat: ["snapchat", "seeknow-social"],
    tiktok: [
      "tiktok",
      "seeknow-tiktok",
      "seeknow-social",
      "intelbase-tiktok",
      "indicia-tiktok",
    ],
    twitter: [
      "seeknow-twitter",
      "seeknow-social",
      "osintcat-twitter",
      "osintbat-twitter",
      "datavoid-twitter",
      "seeknow-history",
    ],
    reddit: [
      "room101-user",
      "room101-analyze",
      "seeknow-reddit",
      "seeknow-social",
      "intelbase-reddit",
    ],
    github: [
      "github",
      "osintbat-github",
      "seeknow-github",
      "seeknow-social",
      "intelfetch-github",
      "intelbase-github",
    ],
    instagram: ["instagram", "instagram-id", "datavoid-instagram", "seeknow-social"],
    fivem: [
      "breachhub-fivem",
      "reconly-fivem",
      "seekria-fivem",
      "datavoid-fivem",
    ],
    phone: [
      "seeknow-phone",
      "nosint-search",
      "truecaller",
      "seon-phone",
      "osintbat-phone",
      "intelbase-phone",
      "telegram-phone",
      "notalivex-tg-phone",
      "oathnet-breach",
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
      "oathnet-stealer-subdomain",
      "oathnet-extract-subdomain",
      "oathnet-breach",
      "oathnet-stealer",
      "oathnet-victims",
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
      "oathnet-breach",
      "oathnet-stealer",
      "oathnet-victims",
      "breachhub-email-osint",
      "seekria-email-osint",
      "seon-email",
      "seon-email-verification",
    ],
    /** Stealer / infection indexes — OathNet stealer + victims first. */
    stealer: [
      "oathnet-stealer",
      "oathnet-victims",
      "oathnet-stealer-subdomain",
      "osintcat-machine-search",
      "wentyn",
      "hudsonrock",
      "seeknow-stealer",
      "datavoid-stealer",
      "intelvault-stealer-logs",
    ],
    victims: ["oathnet-victims", "osintcat-machine-search"],
    breach: ["oathnet-breach"],
    hwid: ["leaksight-hwid"],
    facebook: ["leaksight-facebook", "osintbat-facebook-breach"],
    passport: ["leaksight-passport"],
    crypto: ["breachhub-crypto"],
    "google-docs": ["breachhub-google-docs"],
    ganknow: ["breachhub-ganknow"],
    bin: ["binlist", "seon-bin"],
    vin: ["vin", "intelbase-vin", "intelbase-bmw"],
  };

  const seed = map[scope];

  if (!seed) return null;

  const ids = expandSpecialtyIds(scope, seed);

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
                : scope === "telegram"
                  ? detectBreachHubQueryKind(query, null) === "phone"
                    ? "phone"
                    : "username"
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
                            : scope === "stealer" ||
                                scope === "victims" ||
                                scope === "breach"
                              ? detectBreachHubQueryKind(query, null)
                              : "username";

  return fetchBreachHubByIds(ids, query, kindHint, timeoutMs);
}

function looksLikeRobloxAccountRow(row: Record<string, unknown>): boolean {
  const username =
    asString(row.username) ||
    asString(row.roblox_username) ||
    asString(row.robloxUsername) ||
    asString(row.displayName) ||
    asString(row.name);
  const userId =
    asString(row.userId) ||
    asString(row.user_id) ||
    asString(row.roblox_id) ||
    asString(row.robloxId) ||
    asString(row.id);
  const profileUrl =
    asString(row.profileUrl) ||
    asString(row.profile_url) ||
    asString(row.url) ||
    asString(row.link);

  if (profileUrl && /roblox\.com/i.test(profileUrl)) return true;
  if (userId && /^\d+$/.test(userId) && username) return true;
  if (username && (asString(row.roblox_id) || asString(row.roblox_username))) {
    return true;
  }

  return Boolean(username && userId);
}

function normalizeDiscordToRobloxRow(
  row: Record<string, unknown>,
  discordId: string,
): Record<string, unknown> | null {
  const username =
    asString(row.username) ||
    asString(row.roblox_username) ||
    asString(row.robloxUsername) ||
    asString(row.displayName);
  const userId =
    asString(row.userId) ||
    asString(row.user_id) ||
    asString(row.roblox_id) ||
    asString(row.robloxId);
  let profileUrl =
    asString(row.profileUrl) ||
    asString(row.profile_url) ||
    asString(row.url) ||
    asString(row.link);

  if (profileUrl && !/roblox\.com/i.test(profileUrl)) profileUrl = "";
  if (!profileUrl && userId && /^\d+$/.test(userId)) {
    profileUrl = `https://www.roblox.com/users/${userId}/profile`;
  }

  if (!username && !userId && !profileUrl) return null;

  return {
    ...row,
    ...(username ? { username } : {}),
    ...(userId ? { userId } : {}),
    ...(profileUrl ? { profileUrl } : {}),
    discord_id: discordId,
  };
}

/** Discord ID → Roblox via BreachHub seeknow / OathNet / IntelBase fan-out. */
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
    for (const row of specialty.results) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;

      if (!looksLikeRobloxAccountRow(record)) continue;

      const normalized = normalizeDiscordToRobloxRow(record, cleaned);

      if (normalized) return normalized;
    }

    // Specialty returned rows but none looked like Roblox — still try first.
    const first = specialty.results[0];

    if (first && typeof first === "object" && !Array.isArray(first)) {
      const normalized = normalizeDiscordToRobloxRow(
        first as Record<string, unknown>,
        cleaned,
      );

      if (normalized) return normalized;
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

    if (first) {
      const normalized = normalizeDiscordToRobloxRow(first, cleaned);

      if (normalized) return normalized;
    }

    return normalizeDiscordToRobloxRow(
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {},
      cleaned,
    );
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

/**
 * OathNet log ids are often short opaque tokens (docs example: `abc123def456`).
 * Reject hostnames / DESKTOP-* only — do not require 24+ chars.
 */
export function looksLikeVictimLogId(value: string): boolean {
  const v = value.trim();

  if (!v || v.length < 8) return false;
  // Hostnames / DESKTOP-… are never OathNet log ids.
  if (/^DESKTOP[-_]/i.test(v)) return false;
  if (/[\s\\/]/.test(v)) return false;
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
    v,
  )) {
    return false;
  }
  // Windows-style computer names (HOST-NAME) without looking like opaque ids.
  if (/^[A-Z][A-Z0-9]*-[A-Z0-9]+$/i.test(v) && !/^[a-f0-9-]{8,}$/i.test(v)) {
    return false;
  }
  // Hex / uuid-ish ids used by victim manifests.
  if (/^[a-f0-9]{12,128}$/i.test(v)) return true;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  ) {
    return true;
  }
  // Opaque tokens (OathNet stealer/victim log ids — often 12+ alnum).
  if (v.length >= 12 && /^[a-zA-Z0-9_-]+$/.test(v)) {
    return true;
  }

  return false;
}

/** Stricter check for machine_id / hwid fallbacks (avoid hostnames as log ids). */
function looksLikeMachineBrowseId(value: string): boolean {
  const v = value.trim();

  if (!looksLikeVictimLogId(v)) return false;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  ) {
    return true;
  }
  if (/^[a-f0-9]{24,128}$/i.test(v)) return true;
  if (v.length >= 24 && /^[a-zA-Z0-9_-]+$/.test(v)) return true;

  return false;
}

function asLogId(record: Record<string, unknown>): string {
  const primary = [
    asString(record.log_id),
    asString(record.logId),
    asString(record.victim_id),
    asString(record.victimId),
    asString(record.doc_id),
    asString(record.docId),
    asString(record.import_id),
    asString(record.importId),
  ];

  for (const candidate of primary) {
    if (candidate && looksLikeVictimLogId(candidate)) return candidate;
  }

  // Legacy OathNet `log` field (string or { id / log_id }).
  const legacyLog = record.log;

  if (typeof legacyLog === "string" && looksLikeVictimLogId(legacyLog)) {
    return legacyLog.trim();
  }

  if (legacyLog && typeof legacyLog === "object" && !Array.isArray(legacyLog)) {
    const nested = asLogId(legacyLog as Record<string, unknown>);

    if (nested) return nested;
  }

  const secondary = [
    asString(record.machine_id),
    asString(record.machineId),
    asString(record.uuid),
    asString(record._id),
    asString(record.id),
    asString(record.hwid),
  ];

  for (const candidate of secondary) {
    if (candidate && looksLikeMachineBrowseId(candidate)) return candidate;
  }

  return "";
}

const VICTIM_LIST_KEYS = [
  "logs",
  "victims",
  "archives",
  "devices",
  "machines",
  "results",
  "items",
  "data",
] as const;

function unwrapVictimPayload(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }
  if (typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const buckets: unknown[] = [];

  for (const key of VICTIM_LIST_KEYS) {
    const value = data[key];

    if (Array.isArray(value)) {
      buckets.push(...value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;

      for (const nestedKey of VICTIM_LIST_KEYS) {
        if (nestedKey === "data") continue;
        if (Array.isArray(nested[nestedKey])) {
          buckets.push(...(nested[nestedKey] as unknown[]));
        }
      }
    }
  }

  if (buckets.length === 0 && asLogId(data)) {
    return [data];
  }

  return buckets.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function firstStringish(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstStringish(item);

      if (text) return text;
    }
  }

  return "";
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
      asString(row.url_str) ||
      asString(row.site) ||
      firstStringish(row.domain) ||
      firstStringish(row.subdomain) ||
      asString(row.host);
    const username =
      asString(row.username) ||
      asString(row.login) ||
      firstStringish(row.email) ||
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

function normalizeFileTree(input: unknown, depth = 0): StealerFileNode[] {
  if (!input || depth > 12) return [];

  if (Array.isArray(input)) {
    return input
      .map((item): StealerFileNode | null => {
        if (typeof item === "string") {
          const name = item.trim();

          if (!name) return null;

          return {
            name,
            type: name.includes(".") ? "file" : "folder",
            // Filenames are valid OathNet file_id values when the tree is flat.
            ...(name.includes(".") ? { id: name, path: name } : {}),
          };
        }
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const node = item as Record<string, unknown>;
        const name =
          asString(node.name) ||
          asString(node.filename) ||
          asString(node.path) ||
          asString(node.file_id) ||
          asString(node.fileId) ||
          asString(node.id);
        if (!name) return null;
        const children = normalizeFileTree(
          node.children ??
            node.files ??
            node.entries ??
            node.items ??
            node.nodes,
          depth + 1,
        );
        const typeRaw = asString(node.type).toLowerCase();
        const kindRaw = asString(node.kind).toLowerCase();
        const isFolder =
          children.length > 0 ||
          typeRaw === "folder" ||
          typeRaw === "directory" ||
          typeRaw === "dir" ||
          kindRaw === "folder" ||
          kindRaw === "directory" ||
          kindRaw === "dir" ||
          Boolean(node.is_dir || node.isDir || node.is_directory);
        const count =
          typeof node.count === "number"
            ? node.count
            : typeof node.items === "number"
              ? node.items
              : children.length || undefined;
        const fileId =
          asString(node.file_id) ||
          asString(node.fileId) ||
          asString(node.id) ||
          asString(node.uuid) ||
          asString(node._id) ||
          asString(node.path) ||
          asString(node.full_path) ||
          (!isFolder ? name : "");

        return {
          name,
          type: isFolder ? "folder" : "file",
          ...(!isFolder && fileId ? { id: fileId } : {}),
          ...(isFolder && asString(node.id) ? { id: asString(node.id) } : {}),
          ...(asString(node.path) || asString(node.full_path)
            ? { path: asString(node.path) || asString(node.full_path) }
            : !isFolder
              ? { path: name }
              : {}),
          ...(count !== undefined ? { count } : {}),
          ...(children.length ? { children } : {}),
        };
      })
      .filter((n): n is StealerFileNode => Boolean(n));
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    for (const key of [
      "victim_tree",
      "tree",
      "files",
      "manifest",
      "file_tree",
      "nodes",
      "entries",
      "children",
    ]) {
      const value = obj[key];

      if (Array.isArray(value)) {
        return normalizeFileTree(value, depth + 1);
      }

      // OathNet victim_tree is a single root node object, not an array.
      if (value && typeof value === "object") {
        const node = value as Record<string, unknown>;
        const typeRaw = asString(node.type).toLowerCase();

        if (
          Array.isArray(node.children) ||
          typeRaw === "file" ||
          typeRaw === "folder" ||
          typeRaw === "directory" ||
          typeRaw === "dir" ||
          asString(node.name) ||
          asString(node.file_id) ||
          asString(node.fileId)
        ) {
          const nested = normalizeFileTree(value, depth + 1);

          if (nested.length > 0) return nested;
        }
      }
    }

    // Flat map of folder → files (avoid treating API envelopes as folders)
    const metaKeys = new Set([
      "success",
      "query",
      "message",
      "error",
      "status",
      "count",
      "total",
      "logs",
      "results",
      "data",
      "credits",
      "credit",
      "service",
    ]);
    const nodes: StealerFileNode[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (metaKeys.has(key)) continue;

      if (Array.isArray(value)) {
        const children = normalizeFileTree(value, depth + 1);

        nodes.push({
          name: key,
          type: "folder",
          count: children.length,
          children,
        });
      } else if (value && typeof value === "object") {
        const children = normalizeFileTree(value, depth + 1);

        if (children.length > 0) {
          nodes.push({
            name: key,
            type: "folder",
            count: children.length,
            children,
          });
        }
      }
    }

    return nodes;
  }

  return [];
}

export function extractStealerArchives(
  payload: unknown,
): StealerArchiveEntry[] {
  const rows = unwrapVictimPayload(payload);
  const archives: StealerArchiveEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const logId = asLogId(row);

    if (!logId || seen.has(logId)) continue;
    seen.add(logId);

    const creds = Array.isArray(row.credentials)
      ? normalizeCredentialRows(row.credentials)
      : undefined;
    const files = normalizeFileTree(
      row.victim_tree ??
        row.files ??
        row.tree ??
        row.manifest ??
        row.file_tree,
    );

    archives.push({
      logId,
      label:
        asString(row.machine_id) ||
        asString(row.machineId) ||
        asString(row.hostname) ||
        asString(row.label) ||
        undefined,
      machineId:
        asString(row.machine_id) || asString(row.machineId) || undefined,
      os: asString(row.os) || asString(row.operating_system) || undefined,
      date:
        asString(row.date) ||
        asString(row.indexed_at) ||
        asString(row.pwned_at) ||
        asString(row.created_at) ||
        undefined,
      malware:
        asString(row.malware) ||
        asString(row.stealer) ||
        asString(row.stealer_name) ||
        undefined,
      country:
        asString(row.country) ||
        asString(row.device_country) ||
        asString(row.geo) ||
        undefined,
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

  const trimmed = query.trim();

  if (!trimmed) return [];

  const perCall = Math.min(timeoutMs, 14_000);
  const settled = await Promise.allSettled([
    breachHubGet("/api/oathnet/victims", { query: trimmed }, perCall),
    breachHubGet(
      "/api/osintcat/machine-viewer/search",
      { query: trimmed },
      perCall,
    ),
  ]);

  const archives: StealerArchiveEntry[] = [];

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    archives.push(...extractStealerArchives(result.value));
  }

  return mergeStealerArchiveLists(archives);
}

function mergeStealerArchiveLists(
  list: StealerArchiveEntry[],
): StealerArchiveEntry[] {
  const map = new Map<string, StealerArchiveEntry>();

  for (const entry of list) {
    if (!entry.logId) continue;
    const existing = map.get(entry.logId);

    if (!existing) {
      map.set(entry.logId, entry);
      continue;
    }

    map.set(entry.logId, {
      ...existing,
      ...entry,
      credentials: entry.credentials?.length
        ? entry.credentials
        : existing.credentials,
      files: entry.files?.length ? entry.files : existing.files,
      cookies: entry.cookies?.length ? entry.cookies : existing.cookies,
      summary: entry.summary ?? existing.summary,
      properties: entry.properties ?? existing.properties,
    });
  }

  return [...map.values()];
}

function pickManifestTree(data: Record<string, unknown>): StealerFileNode[] {
  const direct = normalizeFileTree(
    data.victim_tree ??
      data.files ??
      data.tree ??
      data.manifest ??
      data.file_tree ??
      data.children,
  );

  if (direct.length > 0) return direct;

  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    const nested = data.data as Record<string, unknown>;
    const fromNested = normalizeFileTree(
      nested.victim_tree ??
        nested.files ??
        nested.tree ??
        nested.manifest ??
        nested.file_tree ??
        nested.children ??
        nested,
    );

    if (fromNested.length > 0) return fromNested;
  }

  if (Array.isArray(data.data)) {
    const fromDataArr = normalizeFileTree(data.data);

    if (fromDataArr.length > 0) return fromDataArr;
  }

  const fromLogs = extractStealerArchives(data);

  if (fromLogs[0]?.files?.length) return fromLogs[0].files;

  // Last resort: treat the envelope itself as a folder map / root node.
  return normalizeFileTree(data);
}

function buildManifestEntry(
  logId: string,
  data: Record<string, unknown>,
  files: StealerFileNode[],
  base?: StealerArchiveEntry,
): StealerArchiveEntry {
  return {
    logId: logId.trim(),
    label:
      base?.label ||
      asString(data.machine_id) ||
      asString(data.machineId) ||
      asString(data.log_name) ||
      asString(data.hostname) ||
      undefined,
    machineId:
      base?.machineId ||
      asString(data.machine_id) ||
      asString(data.machineId) ||
      undefined,
    os: base?.os || asString(data.os) || undefined,
    date: base?.date || asString(data.date) || undefined,
    malware: base?.malware || asString(data.malware) || undefined,
    country: base?.country || asString(data.country) || undefined,
    ...(base?.credentials?.length ? { credentials: base.credentials } : {}),
    ...(files.length ? { files } : {}),
    summary:
      (base?.summary as Record<string, unknown> | undefined) ||
      (data.summary && typeof data.summary === "object"
        ? (data.summary as Record<string, unknown>)
        : undefined),
    properties:
      (base?.properties as Record<string, unknown> | undefined) ||
      (data.properties && typeof data.properties === "object"
        ? (data.properties as Record<string, unknown>)
        : undefined),
    cookies: base?.cookies?.length
      ? base.cookies
      : Array.isArray(data.cookies)
        ? data.cookies
        : undefined,
  };
}

export async function fetchBreachHubVictimManifest(
  logId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  opts?: { machineId?: string },
): Promise<StealerArchiveEntry | null> {
  if (!isBreachHubEnabled() || !logId.trim()) return null;
  if (!looksLikeVictimLogId(logId)) return null;

  const trimmed = logId.trim();
  const machineId = opts?.machineId?.trim() || "";
  const browseIds = [
    ...new Set(
      [trimmed, machineId].filter(
        (id) => id && looksLikeVictimLogId(id) && !/^DESKTOP[-_]/i.test(id),
      ),
    ),
  ];
  const errors: string[] = [];
  let bestFiles: StealerFileNode[] = [];
  let bestMeta: StealerArchiveEntry | null = null;

  const mergeBest = (entry: StealerArchiveEntry) => {
    const prev = bestMeta;
    const nextFiles = entry.files?.length
      ? entry.files
      : prev?.files?.length
        ? prev.files
        : [];

    bestMeta = {
      ...(prev ?? { logId: trimmed }),
      ...entry,
      credentials: entry.credentials?.length
        ? entry.credentials
        : prev?.credentials,
      files: nextFiles.length ? nextFiles : undefined,
      cookies: entry.cookies?.length ? entry.cookies : prev?.cookies,
      summary: entry.summary ?? prev?.summary,
      properties: entry.properties ?? prev?.properties,
    };
    bestFiles = nextFiles;
  };

  const preferMachineViewer =
    Boolean(machineId) ||
    /^[a-f0-9]{24,128}$/i.test(trimmed) ||
    (trimmed.length >= 32 && /^[a-f0-9-]+$/i.test(trimmed));

  const tryOathNetManifest = async () => {
    try {
      const data = await breachHubGet(
        "/api/oathnet/victims/:log_id",
        {},
        timeoutMs,
        { log_id: trimmed },
      );
      const archives = extractStealerArchives(data);
      const files = pickManifestTree(data);
      const entry = buildManifestEntry(trimmed, data, files, archives[0]);

      mergeBest(entry);
      return files.length > 0;
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "OathNet manifest failed",
      );
      return false;
    }
  };

  const tryOsintCatTrees = async () => {
    const perTree = Math.min(timeoutMs, 18_000);

    for (const id of browseIds) {
      if (bestFiles.length > 0) return true;

      // Prefer treeview; fall back to machine info which sometimes embeds files.
      for (const path of [
        "/api/osintcat/machine-viewer/machines/:machine_id/files/treeview",
        "/api/osintcat/machine-viewer/machines/:machine_id/info",
      ] as const) {
        try {
          const data = await breachHubGet(path, {}, perTree, {
            machine_id: id,
          });
          const archives = extractStealerArchives(data);
          const files = pickManifestTree(data);
          const entry = buildManifestEntry(
            trimmed,
            data,
            files,
            archives[0] ?? bestMeta ?? undefined,
          );

          mergeBest(entry);
          if (files.length > 0) return true;
        } catch (err) {
          errors.push(
            err instanceof Error
              ? err.message
              : `Machine browse failed for ${id.slice(0, 12)}…`,
          );
        }
      }
    }

    return bestFiles.length > 0;
  };

  // Hex / machine_id rows come from OsintCat machine-viewer — try that first.
  // Short OathNet log tokens try OathNet first, then OsintCat fallback.
  if (preferMachineViewer) {
    const ok = await tryOsintCatTrees();
    if (ok) return bestMeta;
    const oathOk = await tryOathNetManifest();
    if (oathOk) return bestMeta;
  } else {
    const oathOk = await tryOathNetManifest();
    if (oathOk) return bestMeta;
    const ok = await tryOsintCatTrees();
    if (ok) return bestMeta;
  }

  if (bestFiles.length > 0) return bestMeta;

  // Surface upstream errors (rate limit / 404 / vendor outage) instead of silent empty.
  if (errors.length > 0 && !bestMeta) {
    const joined = [...new Set(errors)].slice(0, 3).join(" · ");
    throw new Error(joined);
  }

  if (errors.length > 0 && bestMeta && !bestFiles.length) {
    const joined = [...new Set(errors)].slice(0, 3).join(" · ");
    throw new Error(
      joined ||
        "File tree empty — machine index returned metadata without files.",
    );
  }

  return bestMeta;
}

export async function fetchBreachHubVictimArchiveBinary(
  logId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  opts?: { machineId?: string },
): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
} | null> {
  const apiKey = getBreachHubApiKey();

  if (!apiKey || !logId.trim() || !looksLikeVictimLogId(logId)) return null;

  const trimmed = logId.trim();
  const filename = `stealer-${trimmed.slice(0, 12)}.zip`;

  const tryBinaryUrl = async (url: string) => {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/zip, application/octet-stream, application/json",
        "User-Agent": "AnyaInt-BreachHub/1.0",
      },
      cache: "no-store",
      timeoutMs,
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";

    if (
      contentType.includes("application/json") ||
      contentType.includes("text/json")
    ) {
      const text = await readResponseText(res, 8_000);
      let data: Record<string, unknown> = {};

      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        return null;
      }

      const downloadUrl =
        asString(data.download_url) ||
        asString(data.url) ||
        asString(data.archive_url) ||
        asString(data.link);

      if (!downloadUrl) return null;

      const fileRes = await fetchWithTimeout(downloadUrl, {
        method: "GET",
        headers: { "User-Agent": "AnyaInt-BreachHub/1.0" },
        cache: "no-store",
        timeoutMs,
      });

      if (!fileRes.ok) return null;

      return {
        bytes: await fileRes.arrayBuffer(),
        contentType: fileRes.headers.get("content-type") || "application/zip",
        filename,
      };
    }

    return {
      bytes: await res.arrayBuffer(),
      contentType: contentType || "application/zip",
      filename,
    };
  };

  const oathUrl = new URL(
    `${BREACHHUB_BASE}/api/oathnet/victims/${encodeURIComponent(trimmed)}/archive`,
  );

  oathUrl.searchParams.set("key", apiKey);

  const fromOath = await tryBinaryUrl(oathUrl.toString());

  if (fromOath) return fromOath;

  const machineIds = [
    ...new Set(
      [trimmed, opts?.machineId?.trim() || ""].filter(
        (id) =>
          Boolean(id) &&
          looksLikeVictimLogId(id) &&
          !/^DESKTOP[-_]/i.test(id),
      ),
    ),
  ];

  for (const id of machineIds) {
    const catUrl = new URL(
      `${BREACHHUB_BASE}/api/osintcat/machine-viewer/machines/${encodeURIComponent(id)}/download`,
    );

    catUrl.searchParams.set("key", apiKey);

    const fromCat = await tryBinaryUrl(catUrl.toString());

    if (fromCat) return fromCat;
  }

  return null;
}

/** @deprecated Prefer fetchBreachHubVictimArchiveBinary for ZIP streams. */
export async function fetchBreachHubVictimArchiveUrl(
  logId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ downloadUrl?: string; payload?: Record<string, unknown> } | null> {
  if (!isBreachHubEnabled() || !logId.trim()) return null;
  if (!looksLikeVictimLogId(logId)) return null;

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

export async function fetchBreachHubVictimFile(
  logId: string,
  fileId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ content: string; filename?: string } | null> {
  const apiKey = getBreachHubApiKey();

  if (!apiKey || !logId.trim() || !fileId.trim()) return null;
  if (!looksLikeVictimLogId(logId)) return null;

  const url = new URL(
    `${BREACHHUB_BASE}/api/oathnet/victims/${encodeURIComponent(logId.trim())}/files/${encodeURIComponent(fileId.trim())}`,
  );

  url.searchParams.set("key", apiKey);

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/plain, application/json, */*",
        "User-Agent": "AnyaInt-BreachHub/1.0",
      },
      cache: "no-store",
      timeoutMs,
    });

    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const text = await readResponseText(res, timeoutMs);

    if (!text) return null;

    // Upstream docs: "Downloads the file content as a .txt file." — often raw text.
    if (
      contentType.includes("text/plain") ||
      contentType.includes("text/csv") ||
      contentType.includes("octet-stream") ||
      (!contentType.includes("json") && !text.trimStart().startsWith("{") && !text.trimStart().startsWith("["))
    ) {
      return {
        content: text,
        filename: fileId.trim(),
      };
    }

    let data: Record<string, unknown> = {};

    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON body that looked ambiguous — treat as file text.
      return { content: text, filename: fileId.trim() };
    }

    if (data.success === false) return null;

    const pickContent = (record: Record<string, unknown>): string =>
      asString(record.content) ||
      asString(record.data) ||
      asString(record.text) ||
      asString(record.file) ||
      asString(record.body) ||
      asString(record.raw) ||
      (typeof record.data === "string" ? record.data : "");

    let content = pickContent(data);

    if (!content && data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
      content = pickContent(data.data as Record<string, unknown>);
    }

    if (!content && data.file && typeof data.file === "object" && !Array.isArray(data.file)) {
      const nested = data.file as Record<string, unknown>;
      content = pickContent(nested);

      if (content) {
        return {
          content,
          filename:
            asString(nested.name) ||
            asString(nested.filename) ||
            fileId.trim(),
        };
      }
    }

    // Some gateways base64-encode the body.
    const b64 =
      asString(data.content_base64) ||
      asString(data.base64) ||
      asString(data.encoded);

    if (!content && b64) {
      try {
        content = Buffer.from(b64, "base64").toString("utf8");
      } catch {
        content = "";
      }
    }

    if (!content) {
      // Last resort: OsintCat machine-viewer file download (same BreachHub key).
      const alt = await fetchOsintCatMachineFile(fileId.trim(), timeoutMs);

      return alt;
    }

    return {
      content,
      filename:
        asString(data.name) ||
        asString(data.filename) ||
        fileId.trim(),
    };
  } catch {
    try {
      return await fetchOsintCatMachineFile(fileId.trim(), timeoutMs);
    } catch {
      return null;
    }
  }
}

async function fetchOsintCatMachineFile(
  fileId: string,
  timeoutMs: number,
): Promise<{ content: string; filename?: string } | null> {
  const apiKey = getBreachHubApiKey();

  if (!apiKey || !fileId.trim()) return null;

  const url = new URL(
    `${BREACHHUB_BASE}/api/osintcat/machine-viewer/files/${encodeURIComponent(fileId.trim())}/download`,
  );

  url.searchParams.set("key", apiKey);

  const res = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Accept: "text/plain, application/json, */*",
      "User-Agent": "AnyaInt-BreachHub/1.0",
    },
    cache: "no-store",
    timeoutMs,
  });

  if (!res.ok) return null;

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await readResponseText(res, timeoutMs);

  if (!text) return null;

  if (
    contentType.includes("text/plain") ||
    contentType.includes("octet-stream") ||
    (!contentType.includes("json") &&
      !text.trimStart().startsWith("{") &&
      !text.trimStart().startsWith("["))
  ) {
    return { content: text, filename: fileId.trim() };
  }

  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const content =
      asString(data.content) ||
      asString(data.data) ||
      asString(data.text) ||
      asString(data.body);

    if (!content) return null;

    return {
      content,
      filename: asString(data.name) || asString(data.filename) || fileId.trim(),
    };
  } catch {
    return { content: text, filename: fileId.trim() };
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
  // Same vendor already hit via direct OsintCat / CSINT / etc.
  if (shouldSkipBreachHubEndpoint(endpointId)) return null;

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

/**
 * Live OathNet vendor probe via BreachHub (not CSINT). Hits a cheap documented
 * path so the health strip can show OathNet red/green independently of /api/status.
 */
export async function probeOathNet(): Promise<boolean> {
  if (!isBreachHubEnabled()) return false;

  try {
    const data = await breachHubGet(
      "/api/oathnet/ip-info",
      { ip: "1.1.1.1" },
      8_000,
    );

    return Boolean(data && typeof data === "object");
  } catch {
    return false;
  }
}

/** Catalog ids for every BreachHub `/api/oathnet/*` OpenAPI path. */
export const OATHNET_BREACHHUB_ENDPOINT_IDS = [
  "oathnet-breach",
  "oathnet-stealer",
  "oathnet-stealer-subdomain",
  "oathnet-extract-subdomain",
  "oathnet-victims",
  "oathnet-victims-log",
  "oathnet-victims-file",
  "oathnet-victims-archive",
  "oathnet-discord-userinfo",
  "oathnet-discord-history",
  "oathnet-discord-roblox",
  "oathnet-steam",
  "oathnet-xbox",
  "oathnet-roblox",
  "oathnet-mc",
  "oathnet-ip",
  "oathnet-holehe",
  "oathnet-ghunt",
] as const;

function extractIntelxExportContent(payload: unknown): string {
  if (typeof payload === "string") {
    return payload.trim() ? payload : "";
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const data = payload as Record<string, unknown>;

  for (const key of ["content", "data", "text", "body", "raw", "file"]) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) return value;
    // Nested JSON wrappers: { data: { content: "…" } }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = extractIntelxExportContent(value);

      if (nested.trim()) return nested;
    }
  }

  if (typeof data.result === "string" && data.result.trim()) {
    return data.result;
  }
  if (data.result && typeof data.result === "object") {
    const nested = extractIntelxExportContent(data.result);

    if (nested.trim()) return nested;
  }

  return "";
}

/**
 * IntelX file export via BreachHub `/api/intelx`.
 * System ID → `system_id`; Storage ID → `storage_id` + `bucket` (OpenAPI).
 */
export async function fetchBreachHubIntelx(
  storageId: string,
  bucket = "leaks.public",
): Promise<{ content: string; error?: string; bucket: string }> {
  const resolvedBucket = bucket.trim() || "leaks.public";

  if (!isBreachHubEnabled()) {
    return {
      content: "",
      error: publicServiceUnavailable(),
      bucket: resolvedBucket,
    };
  }

  const apiKey = getBreachHubApiKey();

  if (!apiKey) {
    return {
      content: "",
      error: publicServiceUnavailable(),
      bucket: resolvedBucket,
    };
  }

  const trimmed = storageId.trim();
  const hex = trimmed.replace(/[^a-f0-9]/gi, "").toLowerCase();
  const isUuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      trimmed,
    ) || /^[a-f0-9]{32}$/i.test(hex);
  const systemId = isUuid
    ? /^[a-f0-9]{32}$/i.test(hex)
      ? [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20),
        ].join("-")
      : trimmed.toLowerCase()
    : "";

  const paramSets: Record<string, string>[] = [];

  if (systemId) {
    // OpenAPI: UUID via system_id (bucket optional).
    paramSets.push({ system_id: systemId });
    paramSets.push({ system_id: systemId, bucket: resolvedBucket });
  } else if (hex.length >= 40) {
    // OpenAPI: Storage ID requires storage_id + bucket.
    paramSets.push({ storage_id: hex, bucket: resolvedBucket });
    // Compatibility aliases some gateways still accept.
    paramSets.push({ storageid: hex, bucket: resolvedBucket });
  }

  if (paramSets.length === 0) {
    return {
      content: "",
      error: "Enter a Storage ID (long hex) or System ID.",
      bucket: resolvedBucket,
    };
  }

  let lastError = "No export content returned.";

  for (const params of paramSets) {
    try {
      const url = new URL(`${BREACHHUB_BASE}/api/intelx`);

      url.searchParams.set("key", apiKey);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const res = await fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "AnyaInt-BreachHub/1.0",
        },
        cache: "no-store",
        timeoutMs: 60_000,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const text = await readResponseText(res, 60_000);

      if (contentType.includes("text/plain") && res.ok && text.trim()) {
        return {
          content: sanitizePublicContent(text),
          bucket: resolvedBucket,
        };
      }

      let data: Record<string, unknown> = {};

      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        if (res.ok && text.trim()) {
          return {
            content: sanitizePublicContent(text),
            bucket: resolvedBucket,
          };
        }
        lastError = sanitizeBreachHubError(`HTTP ${res.status}`);
        continue;
      }

      if (!res.ok || data.success === false) {
        const msg =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          `HTTP ${res.status}`;

        lastError = sanitizeBreachHubError(msg);
        if (/rate limit|429|quota|capacity/i.test(lastError)) {
          return { content: "", error: lastError, bucket: resolvedBucket };
        }
        continue;
      }

      const content = extractIntelxExportContent(data);

      if (content.trim()) {
        return {
          content: sanitizePublicContent(content),
          bucket: resolvedBucket,
        };
      }
    } catch (err) {
      lastError = sanitizeBreachHubError(
        err instanceof Error ? err.message : publicSearchError(),
      );
      if (/rate limit|429|quota|capacity/i.test(lastError)) {
        return { content: "", error: lastError, bucket: resolvedBucket };
      }
    }
  }

  return { content: "", error: lastError, bucket: resolvedBucket };
}

/** Try preferred + common leak buckets for long Storage IDs. */
export async function fetchBreachHubIntelxWithBuckets(
  storageId: string,
  preferredBucket?: string | null,
): Promise<{ content: string; error?: string; bucket: string }> {
  const preferred = preferredBucket?.trim() || "leaks.public";
  // Prefer OpenAPI buckets; keep CSINT-overlapping names first.
  const ordered = [
    preferred,
    "leaks.public",
    "leaks.private",
    "leaks.private.general",
    "leaks.logs",
    "dumpster",
    "pastes",
    "documents.public",
    "darknet",
  ].filter((b, i, arr) => Boolean(b) && arr.indexOf(b) === i);

  let lastError = "No export content returned.";

  for (const bucket of ordered) {
    const result = await fetchBreachHubIntelx(storageId, bucket);

    if (result.content.trim()) return result;
    if (result.error) {
      lastError = result.error;
      if (/rate limit|429|quota|capacity/i.test(result.error)) {
        return result;
      }
    }
  }

  return {
    content: "",
    error: lastError,
    bucket: ordered[0] || "leaks.public",
  };
}
