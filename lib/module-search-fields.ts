import type {
  ModuleOptionalFilter,
  SearchModuleDef,
} from "@/lib/search-modules";
import { composeModuleQuery } from "@/lib/search-modules";

export type SearchFieldTypeId =
  | "query"
  | "email"
  | "phone"
  | "username"
  | "ip"
  | "domain"
  | "discord-id"
  | "wallet"
  | "tx"
  | "hash"
  | "password"
  | "name"
  | "first-name"
  | "last-name"
  | "state"
  | "city"
  | "county"
  | "zip"
  | "dob"
  | "url"
  | "storage-id"
  | "text";

export type ModuleSearchFieldOption = {
  id: SearchFieldTypeId;
  label: string;
  placeholder: string;
};

export type ModuleSearchFieldRow = {
  id: string;
  type: SearchFieldTypeId;
  value: string;
};

export type ComposedModuleSearch = {
  /** Value sent to OSINT APIs as `query`. */
  query: string;
  firstName: string;
  lastName: string;
  optionalFilters: Partial<Record<ModuleOptionalFilter["id"], string>>;
  /** True when at least one field has a non-empty value. */
  hasInput: boolean;
};

const FILTER_TYPE_IDS = new Set<SearchFieldTypeId>([
  "state",
  "city",
  "county",
  "zip",
  "dob",
]);

const PERSON_NAME_TYPES = new Set<SearchFieldTypeId>([
  "name",
  "first-name",
  "last-name",
]);

const PRIMARY_IDENTIFIER_TYPES: SearchFieldTypeId[] = [
  "email",
  "phone",
  "username",
  "ip",
  "domain",
  "discord-id",
  "wallet",
  "tx",
  "hash",
  "password",
  "storage-id",
  "url",
  "name",
  "query",
  "text",
];

function opt(
  id: SearchFieldTypeId,
  label: string,
  placeholder: string,
): ModuleSearchFieldOption {
  return { id, label, placeholder };
}

const COMMON_QUERY = opt("query", "Query", "Search target…");
const EMAIL = opt("email", "Email", "name@example.com");
const PHONE = opt("phone", "Phone", "+1 555 0100");
const USERNAME = opt("username", "Username", "handle");
const IP = opt("ip", "IP", "203.0.113.10");
const DOMAIN = opt("domain", "Domain", "example.com");
const DISCORD = opt("discord-id", "Discord ID", "17–20 digit ID");
const WALLET = opt("wallet", "Wallet", "BTC / ETH / LTC / SOL address");
const TX = opt("tx", "Tx hash", "0x… or txid / signature");
const HASH = opt("hash", "Hash", "MD5 / SHA-1 / SHA-256…");
const PASSWORD = opt("password", "Password", "Leaked password string");
const NAME = opt("name", "Full name", "Jane Doe");
const FIRST = opt("first-name", "First name", "Jane");
const LAST = opt("last-name", "Last name", "Doe");
const STATE = opt("state", "State", "VA");
const CITY = opt("city", "City", "Richmond");
const COUNTY = opt("county", "County", "Fairfax");
const ZIP = opt("zip", "ZIP", "22030");
const DOB = opt("dob", "DOB", "MM/DD/YYYY");
const URL = opt("url", "URL", "https://…");
const STORAGE = opt("storage-id", "Storage ID", "Paste Storage ID or share URL…");
const TEXT = opt("text", "Text", "Free-text target…");

function uniqueOptions(
  options: ModuleSearchFieldOption[],
): ModuleSearchFieldOption[] {
  const seen = new Set<string>();
  const out: ModuleSearchFieldOption[] = [];

  for (const option of options) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    out.push(option);
  }

  return out;
}

function optionsFromOptionalFilters(
  filters: ModuleOptionalFilter[] | undefined,
): ModuleSearchFieldOption[] {
  if (!filters?.length) return [];

  return filters.map((filter) => {
    switch (filter.id) {
      case "state":
        return STATE;
      case "city":
        return CITY;
      case "county":
        return COUNTY;
      case "zip":
        return ZIP;
      case "dob":
        return DOB;
      default:
        return opt(filter.id, filter.label, filter.placeholder);
    }
  });
}

/**
 * Field types offered for a module — drives the per-row type dropdown.
 */
export function getModuleSearchFieldOptions(
  moduleDef: SearchModuleDef,
): ModuleSearchFieldOption[] {
  const slug = moduleDef.slug;
  const geo = optionsFromOptionalFilters(moduleDef.optionalFilters);

  if (slug === "public-records" || slug.startsWith("us-") || geo.length > 0) {
    return uniqueOptions([FIRST, LAST, NAME, ...geo, EMAIL, PHONE, COMMON_QUERY]);
  }

  if (slug === "stealer-logs" || slug === "domains") {
    return uniqueOptions([IP, EMAIL, DOMAIN, COMMON_QUERY]);
  }

  if (slug === "breaches" || slug === "breachbase") {
    return uniqueOptions([EMAIL, USERNAME, PHONE, DOMAIN, IP, COMMON_QUERY]);
  }

  if (slug === "email-analyze" || slug === "email-presence") {
    return uniqueOptions([EMAIL, PHONE, COMMON_QUERY]);
  }

  if (slug === "phone" || slug === "phone-index") {
    return uniqueOptions([PHONE, EMAIL, NAME, COMMON_QUERY]);
  }

  if (slug === "username" || slug === "account-finder" || slug === "handle-sweep") {
    return uniqueOptions([USERNAME, EMAIL, PHONE, COMMON_QUERY]);
  }

  if (slug === "discord-id" || slug === "fivem" || slug === "oathnet-roblox") {
    return uniqueOptions([DISCORD, USERNAME, COMMON_QUERY]);
  }

  if (slug === "crypto-intel" || slug.startsWith("crypto-")) {
    return uniqueOptions([WALLET, TX, COMMON_QUERY]);
  }

  if (slug === "ip" || slug === "shodan-host" || slug === "geolocate") {
    return uniqueOptions([IP, DOMAIN, COMMON_QUERY]);
  }

  if (slug === "domain" || slug === "site-pentest") {
    return uniqueOptions([DOMAIN, URL, IP, COMMON_QUERY]);
  }

  if (slug === "hash-lookup") {
    return uniqueOptions([HASH, COMMON_QUERY]);
  }

  if (slug === "password-search") {
    return uniqueOptions([PASSWORD, EMAIL, USERNAME, COMMON_QUERY]);
  }

  if (slug === "name-search") {
    return uniqueOptions([NAME, FIRST, LAST, ...geo, COMMON_QUERY]);
  }

  if (slug === "intelx") {
    return uniqueOptions([STORAGE, URL, COMMON_QUERY]);
  }

  if (slug === "fraud-footprint" || slug === "contact-enrich") {
    return uniqueOptions([EMAIL, PHONE, COMMON_QUERY]);
  }

  if (slug === "instagram" || slug === "tiktok" || slug === "tiktok-recon") {
    return uniqueOptions([USERNAME, URL, COMMON_QUERY]);
  }

  if (moduleDef.module === "ai") {
    return uniqueOptions([
      TEXT,
      EMAIL,
      PHONE,
      USERNAME,
      IP,
      DOMAIN,
      WALLET,
      DISCORD,
      NAME,
      COMMON_QUERY,
    ]);
  }

  // Default: parse hint keywords for a sensible starter set.
  const hint = `${moduleDef.hint} ${moduleDef.tagline}`.toLowerCase();
  const guessed: ModuleSearchFieldOption[] = [COMMON_QUERY];

  if (hint.includes("email")) guessed.push(EMAIL);
  if (hint.includes("phone")) guessed.push(PHONE);
  if (hint.includes("username") || hint.includes("handle")) guessed.push(USERNAME);
  if (/\bip\b/.test(hint)) guessed.push(IP);
  if (hint.includes("domain")) guessed.push(DOMAIN);
  if (hint.includes("discord")) guessed.push(DISCORD);
  if (hint.includes("wallet") || hint.includes("bitcoin") || hint.includes("0x")) {
    guessed.push(WALLET, TX);
  }

  return uniqueOptions(
    guessed.length > 1
      ? guessed
      : [COMMON_QUERY, EMAIL, PHONE, USERNAME, IP, DOMAIN],
  );
}

export function createSearchFieldRow(
  type: SearchFieldTypeId,
  value = "",
): ModuleSearchFieldRow {
  return {
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value,
  };
}

export function defaultSearchFieldsForModule(
  moduleDef: SearchModuleDef,
): ModuleSearchFieldRow[] {
  const options = getModuleSearchFieldOptions(moduleDef);
  const initialType =
    moduleDef.slug === "public-records"
      ? "first-name"
      : options[0]?.id ?? "query";

  if (moduleDef.slug === "public-records") {
    return [createSearchFieldRow("first-name"), createSearchFieldRow("last-name")];
  }

  return [createSearchFieldRow(initialType)];
}

function firstValue(
  fields: ModuleSearchFieldRow[],
  type: SearchFieldTypeId,
): string {
  return (
    fields.find((row) => row.type === type && row.value.trim())?.value.trim() ??
    ""
  );
}

function collectFilterValues(
  fields: ModuleSearchFieldRow[],
): Partial<Record<ModuleOptionalFilter["id"], string>> {
  const out: Partial<Record<ModuleOptionalFilter["id"], string>> = {};

  for (const row of fields) {
    if (!FILTER_TYPE_IDS.has(row.type)) continue;
    const value = row.value.trim();

    if (!value) continue;
    out[row.type as ModuleOptionalFilter["id"]] = value;
  }

  return out;
}

/**
 * Fold typed rows into the query string + optional geo filters the rest of
 * ModuleSearchView already understands.
 */
export function composeModuleSearchFields(
  fields: ModuleSearchFieldRow[],
  moduleDef: SearchModuleDef,
): ComposedModuleSearch {
  const filled = fields.filter((row) => row.value.trim());
  const optionalFilters = collectFilterValues(fields);
  const firstName = firstValue(fields, "first-name");
  const lastName = firstValue(fields, "last-name");
  const fullName = firstValue(fields, "name");
  const nameQuery =
    fullName ||
    [firstName, lastName].filter(Boolean).join(" ").trim();

  const hasPersonShape =
    moduleDef.slug === "public-records" ||
    Boolean(moduleDef.optionalFilters?.length) ||
    filled.some((row) => PERSON_NAME_TYPES.has(row.type) || FILTER_TYPE_IDS.has(row.type));

  if (hasPersonShape && (nameQuery || optionalFilters.zip)) {
    const query = composeModuleQuery(nameQuery, optionalFilters);

    return {
      query,
      firstName: firstName || fullName.split(/\s+/)[0] || "",
      lastName:
        lastName ||
        fullName.split(/\s+/).slice(1).join(" ") ||
        "",
      optionalFilters,
      hasInput: Boolean(query),
    };
  }

  // AI: labeled multi-line context helps synthesis.
  if (moduleDef.module === "ai" || filled.some((row) => row.type === "text")) {
    if (filled.length === 0) {
      return {
        query: "",
        firstName: "",
        lastName: "",
        optionalFilters,
        hasInput: false,
      };
    }

    if (filled.length === 1 && filled[0]!.type === "text") {
      return {
        query: filled[0]!.value.trim(),
        firstName: "",
        lastName: "",
        optionalFilters,
        hasInput: true,
      };
    }

    const labeled = filled
      .map((row) => {
        if (row.type === "text" || row.type === "query") {
          return row.value.trim();
        }

        return `${row.type}: ${row.value.trim()}`;
      })
      .join("\n");

    return {
      query: labeled,
      firstName: "",
      lastName: "",
      optionalFilters,
      hasInput: true,
    };
  }

  // Prefer a strong identifier type as the API query.
  let primary = "";

  for (const type of PRIMARY_IDENTIFIER_TYPES) {
    const hit = filled.find((row) => row.type === type);

    if (hit) {
      primary = hit.value.trim();
      break;
    }
  }

  if (!primary && filled[0]) {
    primary = filled[0].value.trim();
  }

  // Extra identifiers (beyond the primary) — append for free-text tolerant modules.
  const extras = filled
    .filter((row) => row.value.trim() !== primary && !FILTER_TYPE_IDS.has(row.type))
    .map((row) => row.value.trim());

  const slug = moduleDef.slug;
  const allowJoin =
    slug === "breaches" ||
    slug === "ai-search" ||
    slug === "ai-deep-scan" ||
    slug === "threat-brief" ||
    moduleDef.module === "ai";

  const query =
    allowJoin && extras.length > 0
      ? [primary, ...extras].filter(Boolean).join(" ")
      : primary;

  return {
    query,
    firstName: "",
    lastName: "",
    optionalFilters,
    hasInput: Boolean(query),
  };
}

export function placeholderForFieldType(
  type: SearchFieldTypeId,
  options: ModuleSearchFieldOption[],
): string {
  return options.find((option) => option.id === type)?.placeholder ?? "Value…";
}
