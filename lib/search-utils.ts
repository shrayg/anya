import { DATABANK_KEYS, extractDatabank, isBrandPlaceholderValue } from "@/lib/intel-record";
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
  /** Full-width readable block (AI summaries, long lists, etc.). */
  block?: boolean;
};

export type FormattedRecord = {
  index: number;
  title: string;
  subtitle?: string;
  badge?: string;
  fields: FormattedField[];
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  username: "Username",
  user_id: "Discord ID",
  discriminator: "Discriminator",
  domain: "Site / URL",
  url: "URL",
  ip: "IP address",
  phone: "Phone",
  token: "Token",
  source: "Source",
  added_at: "Indexed",
  breach_date: "Breach date",
  name: "Name",
  country: "Country",
  country_code: "Country code",
  country_name: "Country",
  city: "City",
  region_code: "Region",
  isp: "ISP",
  hostnames: "Hostnames",
  ports: "Open ports",
  latitude: "Latitude",
  longitude: "Longitude",
  last_update: "Last seen",
  steam: "Steam",
  license: "License",
  uuid: "UUID",
  query: "Query",
  hash: "Hash",
  secret: "Secret",
  identifier: "Identifier",
  raw: "Raw match",
  public_flags: "Public flags",
  global_name: "Display name",
  tag: "Tag",
  score: "Risk score",
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
  ai_summary: "AI summary",
  summary: "Summary",
  analysis: "Analysis",
  overview: "Overview",
  description: "Description",
};

const FIELD_ORDER = [
  "source",
  "email",
  "phone",
  "score",
  "deliverable",
  "valid",
  "disposable",
  "username",
  "user_id",
  "global_name",
  "domain",
  "url",
  "password",
  "ip",
  "token",
  "steam",
  "license",
  "uuid",
  "added_at",
  "breach_date",
  "number_of_breaches",
  "first_breach",
  "breaches",
  "registered_account_count",
  "registered_accounts",
  "country",
  "country_name",
  "city",
  "region_code",
  "isp",
  "carrier",
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
  "phone",
]);

/** Provider branding / meta — never shown as result field rows. */
const HIDDEN_RESULT_KEY =
  /^(source|sources|_source|credit|credits|service|success|provider|providers)$/i;

/** Long prose / list fields — render as full-width text blocks. */
const BLOCK_TEXT_KEY =
  /^(ai_?summary|summary|analysis|overview|report|description|notes?|details|content|export|raw|text|message|reasoning|explanation|registered_accounts|breaches|rules|applied_rules)$/i;

const RECORD_TITLE_KEYS = new Set(["category", "record_title"]);

function isHiddenResultKey(key: string): boolean {
  return HIDDEN_RESULT_KEY.test(key);
}

function isBlockTextField(key: string, value: string): boolean {
  if (BLOCK_TEXT_KEY.test(key)) return true;
  if (value.includes("\n")) return true;
  return value.length > 160;
}

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizePublicText(String(item)))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return sanitizePublicText(JSON.stringify(value));
  }

  return sanitizePublicText(String(value));
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

  const fields = entries
    .map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return null;
      }

      const formatted = formatValue(value);

      if (!formatted) return null;
      if (isBrandPlaceholderValue(formatted)) return null;

      const label = humanizeKey(key);
      if (/^sources?$/i.test(label)) return null;

      return {
        key,
        label,
        value: formatted,
        sensitive: SENSITIVE_KEYS.has(key),
        highlight: HIGHLIGHT_KEYS.has(key),
        block: isBlockTextField(key, formatted),
      };
    })
    .filter((field) => field !== null) as FormattedField[];

  // Compact fields first; full-width prose blocks last.
  fields.sort((a, b) => {
    if (Boolean(a.block) !== Boolean(b.block)) {
      return a.block ? 1 : -1;
    }

    const aIndex = FIELD_ORDER.indexOf(a.key);
    const bIndex = FIELD_ORDER.indexOf(b.key);
    const aRank = aIndex === -1 ? 999 : aIndex;
    const bRank = bIndex === -1 ? 999 : bIndex;

    if (aRank !== bRank) return aRank - bRank;

    return a.label.localeCompare(b.label);
  });

  return fields;
}

function buildRecordFields(data: Record<string, unknown>): FormattedField[] {
  const keys = Object.keys(data).filter(
    (key) =>
      !DATABANK_KEYS.has(key) &&
      !RECORD_TITLE_KEYS.has(key) &&
      !isHiddenResultKey(key),
  );
  // Databank / breach collection names may still title the card, but never as a Source row.
  return objectFields(data, keys);
}

function recordTitle(data: Record<string, unknown>, index: number): string {
  const databank = extractDatabank(data);

  if (databank) return databank;

  if (typeof data.category === "string" && data.category.trim()) {
    return data.category.trim();
  }
  if (typeof data.record_title === "string" && data.record_title.trim()) {
    return data.record_title.trim();
  }

  if (data.email && data.password) return "Leaked credential";
  if (data.user_id) return "Discord leak record";
  if (data.domain && data.email) return "Stealer log entry";
  if (data.username && !data.email) return "Username match";

  return `Record ${index}`;
}

function recordSubtitle(data: Record<string, unknown>): string | undefined {
  if (typeof data.email === "string" && !isBrandPlaceholderValue(data.email)) {
    return data.email;
  }
  if (typeof data.phone === "string" && !isBrandPlaceholderValue(data.phone)) {
    return data.phone;
  }
  if (typeof data.number === "string" || typeof data.number === "number") {
    return String(data.number);
  }
  if (typeof data.username === "string" && !isBrandPlaceholderValue(data.username)) {
    return `@${data.username}`;
  }
  if (typeof data.user_id === "string" && !isBrandPlaceholderValue(data.user_id)) {
    return data.user_id;
  }
  if (typeof data.domain === "string" && !isBrandPlaceholderValue(data.domain)) {
    return data.domain;
  }

  return undefined;
}

function recordBadge(data: Record<string, unknown>): string | undefined {
  return extractDatabank(data) ?? undefined;
}

export function formatSearchRecords(results: unknown[]): FormattedRecord[] {
  return results
    .map((entry, index) => {
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
            },
          ],
        };
      }

      const data = entry as Record<string, unknown>;
      const fields = buildRecordFields(data);

      if (fields.length === 0) return null;

      // Drop cards whose only "data" is brand pollution (Anya.Int as username/password).
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
    })
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
    const hitResults = Array.isArray(indexHits.results) ? indexHits.results : [];

    if (hitResults.length > 0) {
      return formatSearchRecords(hitResults);
    }
  }

  // Legacy key (pre-scrub) — still format if present in older cached results.
  if (record.godseye && typeof record.godseye === "object") {
    const godseye = record.godseye as Record<string, unknown>;
    const godseyeResults = Array.isArray(godseye.results) ? godseye.results : [];

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

  // CSINT-style wrappers: useful payload under `data`, meta at top level.
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

export function formatBreachSearchResults(results: unknown[]): SearchResultRow[] {
  return formatSearchRecords(results).flatMap((record) =>
    record.fields.map((field) => ({
      label: record.fields.length > 1 ? `${record.title} · ${field.label}` : field.label,
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
    if (/^sources?$/i.test(leaf)) continue;

    if (value && typeof value === "object") {
      flattenSearchData(value, label, rows);
    } else {
      rows.push({ label: leaf, value: String(value ?? "") });
    }
  }

  return rows;
}
