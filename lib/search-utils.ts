import {
  DATABANK_KEYS,
  extractDatabank,
  isBrandPlaceholderValue,
} from "@/lib/intel-record";
import { resolveDiscordBadges } from "@/lib/discord-badges";
import { sanitizePublicText } from "@/lib/public-branding";

export type SearchResultRow = {
  label: string;
  value: string;
};

export type FormattedField = {
  key: string;
  label: string;
  value: string;
  sensitive?: boolean;
  highlight?: boolean;
  /** Full-width readable block (long lists, bios, etc.). */
  block?: boolean;
  /** Section header: Profile, Network, Activity, Credentials, More details. */
  group?: string;
};

export type FormattedRecord = {
  index: number;
  title: string;
  subtitle?: string;
  badge?: string;
  fields: FormattedField[];
};

export type FieldSection = {
  id: string;
  label: string;
  fields: FormattedField[];
  /** Advanced / raw — collapsed behind “More details” in the UI. */
  advanced?: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  username: "Username",
  user_id: "Discord ID",
  discord_id: "Discord ID",
  discriminator: "Tag number",
  domain: "Site / URL",
  url: "URL",
  ip: "IP address",
  ip_address: "IP address",
  phone: "Phone",
  token: "Token",
  source: "Source",
  added_at: "Indexed",
  breach_date: "Breach date",
  name: "Name",
  country: "Country",
  country_code: "Country",
  countryCode: "Country",
  country_name: "Country",
  city: "City",
  region: "Region",
  region_code: "Region",
  regionName: "Region",
  region_name: "Region",
  zip: "ZIP",
  isp: "ISP",
  org: "Organization",
  as: "ASN",
  asname: "ASN name",
  mobile: "Mobile",
  proxy: "Proxy / VPN",
  hosting: "Hosting",
  hostnames: "Hostnames",
  ports: "Open ports",
  latitude: "Latitude",
  lat: "Latitude",
  longitude: "Longitude",
  lon: "Longitude",
  last_update: "Last seen",
  last_seen: "Last seen",
  created_at: "Member since",
  account_created_at: "Member since",
  member_since: "Member since",
  steam: "Steam",
  license: "License",
  uuid: "UUID",
  query: "IP address",
  hash: "Hash",
  secret: "Secret",
  identifier: "Identifier",
  raw: "Raw match",
  public_flags: "Badges",
  flags: "Flags",
  badges: "Badges",
  bio: "Bio",
  about: "Bio",
  about_me: "Bio",
  global_name: "Display name",
  display_name: "Display name",
  accent_color: "Accent color",
  banner_color: "Banner color",
  avatar_hash: "Avatar",
  avatar_url: "Avatar",
  medal_id: "Medal ID",
  mutual_servers: "Servers",
  mutual_guilds: "Servers",
  connected_accounts: "Linked accounts",
  connections: "Linked accounts",
  apis: "Linked accounts",
  tag: "Tag",
  score: "Risk",
  risk: "Risk",
  risk_score: "Risk",
  risk_level: "Risk",
  level: "Risk level",
  deliverable: "Deliverable",
  valid: "Valid",
  disposable: "Disposable",
  carrier: "Carrier",
  type: "Line type",
  registered_accounts: "Registered accounts",
  registered_account_count: "Account matches",
  haveibeenpwned_listed: "Listed in breaches",
  number_of_breaches: "Breach count",
  first_breach: "First breach",
  breaches: "Breaches",
  rules: "Applied rules",
  rule_count: "Rule count",
  free: "Free provider",
  valid_mx: "Valid MX",
  dmarc_enforced: "DMARC enforced",
  spf_strict: "SPF strict",
  registrar_name: "Registrar",
  registered_to: "Registered to",
  summary: "Summary",
  analysis: "Analysis",
  overview: "Overview",
  description: "Description",
  ip_geolocation: "Location",
  discord_profile: "Discord profile",
  medal: "Medal",
  database_leaks: "Database leaks",
  osint_data: "OSINT data",
  total_results: "Total results",
  data_found: "Data found",
  fivem: "FiveM",
  meta: "Activity",
  timestamp: "Seen",
  seen_at: "Seen",
  indexed_at: "Indexed",
};

/** Preferred display order within a section. */
const FIELD_ORDER = [
  "global_name",
  "display_name",
  "username",
  "tag",
  "user_id",
  "email",
  "phone",
  "password",
  "score",
  "risk",
  "risk_score",
  "ip",
  "country",
  "country_name",
  "city",
  "region",
  "regionName",
  "isp",
  "org",
  "badges",
  "bio",
  "about",
  "connected_accounts",
  "connections",
  "apis",
  "fivem",
  "domain",
  "url",
  "token",
  "steam",
  "license",
  "uuid",
  "created_at",
  "account_created_at",
  "member_since",
  "added_at",
  "last_seen",
  "last_update",
  "breach_date",
];

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "hash",
  "license",
]);

const HIGHLIGHT_KEYS = new Set([
  "email",
  "username",
  "user_id",
  "domain",
  "score",
  "risk",
  "risk_score",
  "phone",
  "ip",
  "global_name",
]);

/** Collapse near-duplicate keys onto one canonical leaf. */
const CANONICAL_LEAF: Record<string, string> = {
  discord_id: "user_id",
  discordid: "user_id",
  discord: "user_id",
  snowflake: "user_id",
  ip_address: "ip",
  ipaddr: "ip",
  ipv4: "ip",
  mail: "email",
  pass: "password",
  passwd: "password",
  pass_word: "password",
  globalname: "global_name",
  display_name: "global_name",
  displayname: "global_name",
  about_me: "bio",
  about: "bio",
  risk_score: "score",
  riskscore: "score",
  risk: "score",
  connections: "connected_accounts",
  apis: "connected_accounts",
  linked_accounts: "connected_accounts",
  last_update: "last_seen",
  seen_at: "last_seen",
  account_created_at: "member_since",
  created_at: "member_since",
  country_code: "country",
  countrycode: "country",
  country_name: "country",
  region_code: "region",
  regionname: "region",
  region_name: "region",
};

/** Provider branding / meta / AI prose — never shown as result field rows. */
const HIDDEN_RESULT_KEY =
  /^(source|sources|_source|credit|credits|service|success|status|provider|providers|ai_?summary|ai_?analysis|ai_?brief|ai_?insights?|ai_?report|llm_?summary|case_?summary)$/i;

const ERROR_RESULT_KEY = /error|exception|failure|failed/i;

/** Nested objects worth expanding into labeled field groups. */
const EXPANDABLE_OBJECT_KEY =
  /^(ip_?geolocation|geolocation|geo|discord_?profile|profile|medal|database_?leaks|osint_?data|avatar_?decoration_?data|primary_?guild|clan|user|account|location|network|meta|risk|fivem)$/i;

/** Long prose / list fields — render as full-width text blocks. */
const BLOCK_TEXT_KEY =
  /^(summary|analysis|overview|report|description|notes?|details|content|export|raw|text|message|reasoning|explanation|registered_accounts|breaches|rules|applied_rules|bio|about|badges|connected_accounts|connections|apis|fivem)$/i;

const RECORD_TITLE_KEYS = new Set(["category", "record_title"]);

const PROFILE_KEYS =
  /^(username|user|tag|global_?name|display_?name|name|user_?id|discord_?id|discriminator|bio|about|about_?me|badges?|public_?flags|flags|avatar|avatar_?url|avatar_?hash|email|phone|medal)$/i;

const NETWORK_KEYS =
  /^(ip|ip_?address|query|country|country_?code|country_?name|city|region|region_?code|region_?name|zip|isp|org|as|asname|proxy|hosting|hostnames?|ports?|lat|latitude|lon|longitude|location|geolocation|network)$/i;

const ACTIVITY_KEYS =
  /^(member_?since|created_?at|account_?created|added_?at|last_?seen|last_?update|seen_?at|indexed_?at|breach_?date|timestamp|fivem|mutual_?servers|mutual_?guilds|connected_?accounts|connections|apis)$/i;

const CREDENTIAL_KEYS =
  /^(password|pass|passwd|token|secret|hash|license)$/i;

const SECTION_ORDER = [
  "Profile",
  "Network",
  "Activity",
  "Credentials",
  "More details",
] as const;

function leafKey(key: string): string {
  const leaf = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;

  return leaf.replace(/[^a-zA-Z0-9_]/g, "_");
}

function canonicalLeaf(key: string): string {
  const leaf = leafKey(key).toLowerCase();

  return CANONICAL_LEAF[leaf] ?? leaf;
}

function isHiddenResultKey(key: string): boolean {
  const leaf = leafKey(key);

  if (HIDDEN_RESULT_KEY.test(leaf) || ERROR_RESULT_KEY.test(leaf)) return true;
  // Nested AI prose: profile.ai_summary, data.ai_summary, etc.
  if (/(^|\.)ai[_-]?summary$/i.test(key)) return true;
  if (/(^|\.)ai[_-]?analysis$/i.test(key)) return true;

  return false;
}

function isBlockTextField(key: string, value: string): boolean {
  if (BLOCK_TEXT_KEY.test(leafKey(key))) return true;
  if (value.includes("\n")) return true;

  return value.length > 160;
}

function humanizeKey(key: string): string {
  const leaf = leafKey(key);
  const canonical = canonicalLeaf(leaf);

  if (FIELD_LABELS[canonical]) return FIELD_LABELS[canonical];
  if (FIELD_LABELS[leaf]) return FIELD_LABELS[leaf];

  const label = leaf
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return sanitizePublicText(label);
}

function sectionForKey(key: string): (typeof SECTION_ORDER)[number] {
  const leaf = canonicalLeaf(key);

  if (CREDENTIAL_KEYS.test(leaf)) return "Credentials";
  if (PROFILE_KEYS.test(leaf)) return "Profile";
  if (NETWORK_KEYS.test(leaf)) return "Network";
  if (ACTIVITY_KEYS.test(leaf)) return "Activity";

  return "More details";
}

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();

  if (
    !(
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    )
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  const parsed = tryParseJson(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
}

function coercePlainObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    return tryParseJsonObject(value);
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function shouldExpandObject(key: string, obj: Record<string, unknown>): boolean {
  if (EXPANDABLE_OBJECT_KEY.test(leafKey(key))) return true;

  const keys = Object.keys(obj).filter((k) => !isHiddenResultKey(k));

  if (keys.length < 2 || keys.length > 36) return false;

  return keys.every((k) => {
    const v = obj[k];

    return (
      v == null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    );
  });
}

function looksLikeIsoDate(text: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(
      text,
    ) || /^\d{10,13}$/.test(text)
  );
}

function formatFriendlyDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  let date: Date | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN;

    if (Number.isFinite(ms)) date = new Date(ms);
  } else if (typeof value === "string") {
    const text = value.trim();

    if (/^\d{10,13}$/.test(text)) {
      const num = Number(text);
      const ms = text.length >= 13 ? num : num * 1000;

      date = new Date(ms);
    } else if (looksLikeIsoDate(text)) {
      date = new Date(text);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function riskLabelFromParts(score?: unknown, level?: unknown): string | null {
  const levelText =
    typeof level === "string" && level.trim()
      ? level.trim().toLowerCase()
      : typeof score === "string" && /^(low|med(ium)?|high|critical|none|unknown)$/i.test(score.trim())
        ? score.trim().toLowerCase()
        : "";

  let numeric: number | null = null;

  if (typeof score === "number" && Number.isFinite(score)) {
    numeric = score;
  } else if (typeof score === "string" && /^\d+(\.\d+)?$/.test(score.trim())) {
    numeric = Number(score.trim());
  }

  const prettyLevel = levelText
    ? levelText.replace(/^med$/, "medium").replace(/\b\w/g, (c) => c.toUpperCase())
    : numeric == null
      ? null
      : numeric <= 0
        ? "Low"
        : numeric < 40
          ? "Low"
          : numeric < 70
            ? "Medium"
            : "High";

  if (!prettyLevel && numeric == null) return null;

  if (prettyLevel && numeric != null && numeric > 0) {
    return `${prettyLevel} (${numeric})`;
  }

  return prettyLevel ?? String(numeric);
}

function formatBadgesValue(value: unknown): string | null {
  let tokens: string[] = [];

  if (Array.isArray(value)) {
    tokens = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  } else if (typeof value === "number" && Number.isFinite(value)) {
    // public_flags bitfield — leave numeric formatting to badge resolver via string key names when possible
    return value === 0 ? "None" : `Flags ${value}`;
  } else if (typeof value === "string") {
    const text = value.trim();

    if (!text || /^none$/i.test(text) || text === "0" || text === "[]") {
      return "None";
    }

    const parsed = tryParseJson(text);

    if (Array.isArray(parsed)) {
      tokens = parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    } else {
      tokens = text
        .split(/[,|;]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
  } else {
    return null;
  }

  if (tokens.length === 0) return "None";

  const resolved = resolveDiscordBadges(tokens);

  if (resolved.length > 0) {
    return resolved.map((badge) => badge.label).join(", ");
  }

  return tokens
    .map((token) =>
      token
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(", ");
}

function formatLinkedAccounts(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const parsed = tryParseJson(value);

    if (parsed != null) return formatLinkedAccounts(parsed);

    const text = sanitizePublicText(value.trim());

    return text || null;
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string" || typeof item === "number") {
          return String(item);
        }
        if (typeof item !== "object") return "";

        const obj = item as Record<string, unknown>;
        const type =
          obj.type ?? obj.platform ?? obj.name ?? obj.provider ?? obj.service;
        const name =
          obj.name ??
          obj.username ??
          obj.handle ??
          obj.id ??
          obj.value ??
          obj.url;

        if (type && name && String(type) !== String(name)) {
          return `${humanizeKey(String(type))}: ${name}`;
        }

        return formatScalarValue(name ?? type) || "";
      })
      .map((line) => sanitizePublicText(line))
      .filter(Boolean);

    return lines.length > 0 ? lines.join("\n") : null;
  }

  const obj = coercePlainObject(value);

  if (!obj) return null;

  const lines = Object.entries(obj)
    .filter(([key]) => !isHiddenResultKey(key))
    .map(([key, val]) => {
      const formatted = formatScalarValue(val);

      if (!formatted) return "";

      return `${humanizeKey(key)}: ${formatted}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
}

function formatFivemValue(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const parsed = tryParseJson(value);

    if (parsed != null) return formatFivemValue(parsed);

    const text = sanitizePublicText(value.trim());

    return text || null;
  }

  if (Array.isArray(value)) {
    return formatLinkedAccounts(value);
  }

  const obj = coercePlainObject(value);

  if (!obj) return null;

  const preferred = [
    "name",
    "username",
    "player",
    "license",
    "steam",
    "discord",
    "ip",
    "server",
    "server_name",
    "id",
    "uuid",
  ];
  const parts: string[] = [];

  for (const key of preferred) {
    if (!(key in obj)) continue;
    if (isHiddenResultKey(key)) continue;

    const formatted = formatScalarValue(obj[key]);

    if (!formatted) continue;
    parts.push(`${humanizeKey(key)}: ${formatted}`);
  }

  for (const [key, val] of Object.entries(obj)) {
    if (preferred.includes(key)) continue;
    if (isHiddenResultKey(key)) continue;

    const formatted = formatScalarValue(val);

    if (!formatted) continue;
    parts.push(`${humanizeKey(key)}: ${formatted}`);
    if (parts.length >= 8) break;
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function formatScalarValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const text = sanitizePublicText(value.trim());

    if (!text || /^\[object object\]$/i.test(text)) return "";

    return text;
  }

  return "";
}

function formatValueForKey(key: string, value: unknown): string {
  const leaf = canonicalLeaf(key);

  if (
    /^(member_?since|created_?at|account_?created|added_?at|last_?seen|last_?update|seen_?at|indexed_?at|breach_?date|timestamp)$/i.test(
      leaf,
    )
  ) {
    const date = formatFriendlyDate(value);

    if (date) return date;
  }

  if (/^(score|risk|risk_?score|risk_?level|level)$/i.test(leaf)) {
    if (typeof value === "object" && value && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const merged = riskLabelFromParts(
        obj.score ?? obj.risk ?? obj.risk_score ?? obj.value,
        obj.level ?? obj.risk_level ?? obj.label,
      );

      if (merged) return merged;
    }

    const merged = riskLabelFromParts(value, undefined);

    if (merged) return merged;
  }

  if (/^(badges?|public_?flags)$/i.test(leaf)) {
    const badges = formatBadgesValue(value);

    if (badges) return badges;
  }

  if (/^(connected_?accounts|connections|apis|linked_?accounts)$/i.test(leaf)) {
    const linked = formatLinkedAccounts(value);

    if (linked) return linked;
  }

  if (/^fivem$/i.test(leaf)) {
    const fivem = formatFivemValue(value);

    if (fivem) return fivem;
  }

  return formatValue(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const parts: string[] = [];

          for (const [nestedKey, nestedVal] of Object.entries(obj)) {
            if (isHiddenResultKey(nestedKey)) continue;

            const nestedFormatted = formatScalarValue(nestedVal);

            if (!nestedFormatted) continue;
            parts.push(`${humanizeKey(nestedKey)}: ${nestedFormatted}`);
          }

          return sanitizePublicText(parts.slice(0, 6).join(" · "));
        }

        return sanitizePublicText(String(item));
      })
      .filter((item) => item && !/^\[object object\]$/i.test(item))
      .join(", ");
  }

  const scalar = formatScalarValue(value);

  if (scalar) {
    if (looksLikeIsoDate(scalar)) {
      return formatFriendlyDate(scalar) ?? scalar;
    }

    return scalar;
  }

  const obj = coercePlainObject(value);

  if (obj) {
    const parts: string[] = [];

    for (const [nestedKey, nestedVal] of Object.entries(obj)) {
      if (isHiddenResultKey(nestedKey)) continue;

      const nestedFormatted = formatScalarValue(nestedVal);

      if (!nestedFormatted) continue;
      parts.push(`${humanizeKey(nestedKey)}: ${nestedFormatted}`);
    }

    if (parts.length === 0) return "";

    return sanitizePublicText(parts.slice(0, 8).join(" · "));
  }

  const text = sanitizePublicText(String(value));

  if (!text || /^\[object object\]$/i.test(text)) return "";

  return text;
}

function makeField(
  key: string,
  value: unknown,
  group?: string,
): FormattedField | null {
  const formatted = formatValueForKey(key, value);

  if (!formatted) return null;
  if (isBrandPlaceholderValue(formatted)) return null;
  if (/invalid\s+api\s*key/i.test(formatted)) return null;
  // Belt-and-suspenders: never surface AI markdown walls.
  if (/^##\s*overview\b/i.test(formatted) && /breach exposure/i.test(formatted)) {
    return null;
  }

  const label = humanizeKey(key);

  if (!label.trim() || /^sources?$/i.test(label) || /^ai summary$/i.test(label)) {
    return null;
  }

  const leaf = canonicalLeaf(key);
  const resolvedGroup = group ?? sectionForKey(key);

  return {
    key: leaf === leafKey(key).toLowerCase() ? leaf : key,
    label,
    value: formatted,
    sensitive: SENSITIVE_KEYS.has(leaf),
    highlight: HIGHLIGHT_KEYS.has(leaf),
    block: isBlockTextField(leaf, formatted),
    group: resolvedGroup,
  };
}

function expandObjectFields(
  key: string,
  value: unknown,
): FormattedField[] | null {
  const obj = coercePlainObject(value);

  if (!obj || !shouldExpandObject(key, obj)) return null;

  // Risk objects → single friendly field.
  if (/^(risk|score|risk_?score)$/i.test(leafKey(key))) {
    const field = makeField(key, obj, sectionForKey(key));

    return field ? [field] : null;
  }

  const parentSection = sectionForKey(key);
  const fields: FormattedField[] = [];

  for (const [nestedKey, nestedVal] of Object.entries(obj)) {
    if (isHiddenResultKey(nestedKey)) continue;

    const nestedObj = coercePlainObject(nestedVal);

    if (nestedObj && shouldExpandObject(nestedKey, nestedObj)) {
      const deeper = expandObjectFields(nestedKey, nestedObj);

      if (deeper && deeper.length > 0) {
        fields.push(
          ...deeper.map((field) => ({
            ...field,
            group: field.group ?? parentSection,
            key: `${key}.${field.key}`,
          })),
        );
        continue;
      }
    }

    const field = makeField(
      `${key}.${nestedKey}`,
      nestedVal,
      sectionForKey(nestedKey) === "More details"
        ? parentSection
        : sectionForKey(nestedKey),
    );

    if (field) {
      fields.push({
        ...field,
        label: humanizeKey(nestedKey),
      });
    }
  }

  return fields.length > 0 ? fields : null;
}

function dedupeFields(fields: FormattedField[]): FormattedField[] {
  const best = new Map<string, FormattedField>();

  for (const field of fields) {
    const canon = canonicalLeaf(field.key);
    const valueKey = field.value.trim().toLowerCase();
    // Same canonical key OR identical label+value collapses duplicates
    // (e.g. Discord ID shown twice under user_id / discord_id).
    const mapKey = `${canon}::${valueKey}`;
    const altKey = `${canon}`;
    const prev = best.get(altKey) ?? best.get(mapKey);

    if (!prev) {
      best.set(altKey, { ...field, key: canon, label: humanizeKey(canon) });
      continue;
    }

    // Keep richer / longer value; prefer highlighted / non-block when equal.
    const prevScore =
      prev.value.length + (prev.highlight ? 20 : 0) - (prev.block ? 5 : 0);
    const nextScore =
      field.value.length + (field.highlight ? 20 : 0) - (field.block ? 5 : 0);

    if (nextScore > prevScore) {
      best.set(altKey, {
        ...field,
        key: canon,
        label: humanizeKey(canon),
        group: prev.group ?? field.group,
      });
    }
  }

  // Second pass: drop fields that only repeat a value already shown under
  // another label (exact same string on Discord ID + IP rows is rare; same
  // Discord ID value under two labels is common).
  const seenValues = new Map<string, string>();
  const out: FormattedField[] = [];

  for (const field of best.values()) {
    const valueKey = field.value.trim().toLowerCase();
    const canon = canonicalLeaf(field.key);

    if (
      /^(user_id|ip|email|username|score|password)$/i.test(canon) &&
      seenValues.has(valueKey)
    ) {
      continue;
    }

    seenValues.set(valueKey, canon);
    out.push(field);
  }

  return out;
}

function sortFields(fields: FormattedField[]): FormattedField[] {
  return [...fields].sort((a, b) => {
    const aGroup = a.group ?? "More details";
    const bGroup = b.group ?? "More details";
    const aSection = SECTION_ORDER.indexOf(
      aGroup as (typeof SECTION_ORDER)[number],
    );
    const bSection = SECTION_ORDER.indexOf(
      bGroup as (typeof SECTION_ORDER)[number],
    );
    const aRank = aSection === -1 ? 99 : aSection;
    const bRank = bSection === -1 ? 99 : bSection;

    if (aRank !== bRank) return aRank - bRank;

    if (Boolean(a.block) !== Boolean(b.block)) {
      return a.block ? 1 : -1;
    }

    const aBase = canonicalLeaf(a.key);
    const bBase = canonicalLeaf(b.key);
    const aIndex = FIELD_ORDER.indexOf(aBase);
    const bIndex = FIELD_ORDER.indexOf(bBase);
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;

    if (aOrder !== bOrder) return aOrder - bOrder;

    return a.label.localeCompare(b.label);
  });
}

function objectFields(
  data: Record<string, unknown>,
  keys?: string[],
): FormattedField[] {
  const entries = keys
    ? keys
        .filter((key) => key in data && !isHiddenResultKey(key))
        .map((key) => [key, data[key]] as const)
    : Object.entries(data).filter(([key]) => !isHiddenResultKey(key));

  const fields: FormattedField[] = [];

  // Merge risk + level into one field when both present at top level.
  const riskScore = data.score ?? data.risk ?? data.risk_score;
  const riskLevel = data.level ?? data.risk_level;

  if (
    riskScore != null &&
    riskLevel != null &&
    typeof riskLevel === "string"
  ) {
    const merged = riskLabelFromParts(riskScore, riskLevel);

    if (merged) {
      fields.push({
        key: "score",
        label: "Risk",
        value: merged,
        highlight: true,
        group: "Profile",
      });
    }
  }

  const skipKeys = new Set<string>();

  if (fields.some((field) => field.key === "score")) {
    skipKeys.add("score");
    skipKeys.add("risk");
    skipKeys.add("risk_score");
    skipKeys.add("level");
    skipKeys.add("risk_level");
  }

  for (const [key, value] of entries) {
    if (skipKeys.has(key)) continue;

    const expanded = expandObjectFields(key, value);

    if (expanded) {
      fields.push(...expanded);
      continue;
    }

    const field = makeField(key, value);

    if (field) fields.push(field);
  }

  return sortFields(dedupeFields(fields));
}

function buildRecordFields(data: Record<string, unknown>): FormattedField[] {
  const keys = Object.keys(data).filter(
    (key) =>
      !DATABANK_KEYS.has(key) &&
      !RECORD_TITLE_KEYS.has(key) &&
      !isHiddenResultKey(key),
  );

  return objectFields(data, keys);
}

function pickString(
  data: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      const text = sanitizePublicText(value.trim());

      if (text && !isBrandPlaceholderValue(text)) return text;
    }
  }

  return undefined;
}

function recordIdentity(data: Record<string, unknown>): string | undefined {
  const display = pickString(data, [
    "global_name",
    "display_name",
    "name",
  ]);
  const username = pickString(data, ["username", "user", "tag"]);

  if (display && username) {
    const handle = username.replace(/^@/, "");

    if (display.toLowerCase() !== handle.toLowerCase()) {
      return `${display} (@${handle})`;
    }

    return display;
  }

  if (display) return display;
  if (username) return `@${username.replace(/^@/, "")}`;

  return undefined;
}

function recordTitle(data: Record<string, unknown>, index: number): string {
  const identity = recordIdentity(data);

  if (identity) return identity;

  const databank = extractDatabank(data);

  if (databank) return databank;

  if (typeof data.category === "string" && data.category.trim()) {
    return data.category.trim();
  }
  if (typeof data.record_title === "string" && data.record_title.trim()) {
    return data.record_title.trim();
  }

  if (data.email && data.password) return "Leaked credential";
  if (data.user_id || data.discord_id) return "Discord account";
  if (data.domain && data.email) return "Stealer log entry";
  if (data.username && !data.email) return "Username match";

  return `Record ${index}`;
}

function recordSubtitle(data: Record<string, unknown>): string | undefined {
  const identity = recordIdentity(data);
  const databank = extractDatabank(data);

  if (identity && databank) return databank;

  if (typeof data.email === "string" && !isBrandPlaceholderValue(data.email)) {
    return data.email;
  }
  if (typeof data.phone === "string" && !isBrandPlaceholderValue(data.phone)) {
    return data.phone;
  }
  if (typeof data.number === "string" || typeof data.number === "number") {
    return String(data.number);
  }
  if (
    !identity &&
    typeof data.username === "string" &&
    !isBrandPlaceholderValue(data.username)
  ) {
    return `@${data.username}`;
  }

  const discordId = pickString(data, ["user_id", "discord_id"]);

  if (discordId) return discordId;

  if (
    typeof data.domain === "string" &&
    !isBrandPlaceholderValue(data.domain)
  ) {
    return data.domain;
  }

  if (databank) return databank;

  return undefined;
}

function recordBadge(data: Record<string, unknown>): string | undefined {
  const risk = riskLabelFromParts(
    data.score ?? data.risk ?? data.risk_score,
    data.level ?? data.risk_level,
  );

  if (risk && !/^low$/i.test(risk)) return `Risk: ${risk}`;

  const identity = recordIdentity(data);
  const databank = extractDatabank(data);

  if (identity && databank) return databank;

  return databank ?? undefined;
}

/** Group formatted fields into human sections for result cards. */
export function groupRecordFields(fields: FormattedField[]): FieldSection[] {
  const buckets = new Map<string, FormattedField[]>();

  for (const field of fields) {
    const label = field.group ?? sectionForKey(field.key);
    const list = buckets.get(label) ?? [];

    list.push(field);
    buckets.set(label, list);
  }

  return SECTION_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    fields: buckets.get(label)!,
    advanced: label === "More details",
  }));
}

/** One-line preview chips for collapsed cards. */
export function recordPreviewFacts(record: FormattedRecord): string[] {
  const facts: string[] = [];
  const byKey = new Map(
    record.fields.map((field) => [canonicalLeaf(field.key), field.value]),
  );

  const risk = byKey.get("score");
  const ip = byKey.get("ip");
  const city = byKey.get("city");
  const country = byKey.get("country");
  const email = byKey.get("email");

  if (risk) facts.push(`Risk: ${risk}`);
  if (ip) facts.push(ip);
  if (city || country) {
    facts.push([city, country].filter(Boolean).join(", "));
  } else if (email) {
    facts.push(email);
  }

  return facts.slice(0, 3);
}

export function formatSearchRecords(results: unknown[]): FormattedRecord[] {
  const records: Array<FormattedRecord | null> = results.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      const value = String(entry ?? "").trim();

      if (!value || isBrandPlaceholderValue(value)) return null;

      return {
        index: index + 1,
        title: `Record ${index + 1}`,
        fields: [
          {
            key: "value",
            label: "Value",
            value,
            group: "More details",
          },
        ],
      };
    }

    const data = entry as Record<string, unknown>;
    const fields = buildRecordFields(data);

    if (fields.length === 0) return null;

    const useful = fields.some(
      (field) => field.value.trim() && !isBrandPlaceholderValue(field.value),
    );

    if (!useful) return null;

    return {
      index: index + 1,
      title: recordTitle(data, index + 1),
      subtitle: recordSubtitle(data),
      badge: recordBadge(data),
      fields,
    };
  });

  return records
    .filter((record): record is FormattedRecord => record !== null)
    .map((record, index) => ({ ...record, index: index + 1 }));
}

function formatIpRecords(data: Record<string, unknown>): FormattedRecord[] {
  const records: FormattedRecord[] = [];
  const geo = data.ipleaks as Record<string, unknown> | undefined;
  const info = data.ipinfo as Record<string, unknown> | undefined;

  if (geo) {
    records.push({
      index: records.length + 1,
      title: "Geolocation & network",
      subtitle: formatValue(geo.ip ?? info?.ip),
      fields: objectFields(geo),
    });
  }

  if (info) {
    records.push({
      index: records.length + 1,
      title: "IP enrichment",
      fields: objectFields(info),
    });
  }

  return records;
}

export function formatStructuredSearchData(data: unknown): FormattedRecord[] {
  if (Array.isArray(data)) {
    return formatSearchRecords(data);
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  let record = data as Record<string, unknown>;

  if (record.ipleaks || record.ipinfo) {
    return formatIpRecords(record);
  }

  if (record.indexHits && typeof record.indexHits === "object") {
    const indexHits = record.indexHits as Record<string, unknown>;
    const hitResults = Array.isArray(indexHits.results)
      ? indexHits.results
      : [];

    if (hitResults.length > 0) {
      return formatSearchRecords(hitResults);
    }
  }

  if (record.godseye && typeof record.godseye === "object") {
    const godseye = record.godseye as Record<string, unknown>;
    const godseyeResults = Array.isArray(godseye.results)
      ? godseye.results
      : [];

    if (godseyeResults.length > 0) {
      return formatSearchRecords(godseyeResults);
    }
  }

  if (Array.isArray(record.results)) {
    return formatSearchRecords(record.results);
  }

  if (
    record.profile &&
    typeof record.profile === "object" &&
    !Array.isArray(record.profile)
  ) {
    const profileRecords = formatSearchRecords([record.profile]);

    if (profileRecords.length > 0) return profileRecords;
  }

  if (Array.isArray(record.breach_data)) {
    return formatSearchRecords(record.breach_data);
  }

  const nested = record.data;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    const nestedFields = objectFields(nestedObj);

    if (nestedFields.length > 0) {
      record = nestedObj;
    }
  }

  const fields = objectFields(record);

  if (fields.length === 0) return [];

  return [
    {
      index: 1,
      title: recordTitle(record, 1),
      subtitle: recordSubtitle(record),
      badge: recordBadge(record),
      fields,
    },
  ];
}

export function formatBreachSearchResults(
  results: unknown[],
): SearchResultRow[] {
  return formatSearchRecords(results).flatMap((record) =>
    record.fields.map((field) => ({
      label:
        record.fields.length > 1
          ? `${record.title} · ${field.label}`
          : field.label,
      value: field.value,
    })),
  );
}

export function flattenSearchData(
  data: unknown,
  prefix = "",
  rows: SearchResultRow[] = [],
): SearchResultRow[] {
  if (data === null || data === undefined) return rows;

  if (Array.isArray(data)) {
    rows.push({
      label: prefix || "Results",
      value: data.map((item) => JSON.stringify(item)).join(" · "),
    });

    return rows;
  }

  if (typeof data !== "object") {
    rows.push({ label: prefix || "Value", value: String(data) });

    return rows;
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isHiddenResultKey(key)) continue;

    const label = prefix ? `${prefix}.${key}` : key;
    const leaf = humanizeKey(label.split(".").pop() ?? label);

    if (/^sources?$/i.test(leaf) || /^ai summary$/i.test(leaf)) continue;

    if (value && typeof value === "object") {
      flattenSearchData(value, label, rows);
    } else {
      rows.push({ label: leaf, value: String(value ?? "") });
    }
  }

  return rows;
}
