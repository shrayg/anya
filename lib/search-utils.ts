import { DATABANK_KEYS, extractDatabank } from "@/lib/intel-record";

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
};

const FIELD_ORDER = [
  "source",
  "email",
  "username",
  "user_id",
  "global_name",
  "domain",
  "url",
  "password",
  "ip",
  "phone",
  "token",
  "steam",
  "license",
  "uuid",
  "added_at",
  "breach_date",
  "country",
  "country_name",
  "city",
  "region_code",
  "isp",
];

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "hash",
  "license",
]);

const HIGHLIGHT_KEYS = new Set(["email", "username", "user_id", "domain"]);

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
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function objectFields(
  data: Record<string, unknown>,
  keys?: string[],
): FormattedField[] {
  const entries = keys
    ? keys
        .filter((key) => key in data)
        .map((key) => [key, data[key]] as const)
    : Object.entries(data);

  const fields = entries
    .map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return null;
      }

      const formatted = formatValue(value);

      if (!formatted) return null;

      return {
        key,
        label: humanizeKey(key),
        value: formatted,
        sensitive: SENSITIVE_KEYS.has(key),
        highlight: HIGHLIGHT_KEYS.has(key),
      };
    })
    .filter((field) => field !== null) as FormattedField[];

  fields.sort((a, b) => {
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
  const databank = extractDatabank(data);
  const keys = Object.keys(data).filter((key) => !DATABANK_KEYS.has(key));
  const fields = objectFields(data, keys);

  if (databank) {
    fields.unshift({
      key: "source",
      label: "Source",
      value: databank,
    });

    fields.sort((a, b) => {
      const aIndex = FIELD_ORDER.indexOf(a.key);
      const bIndex = FIELD_ORDER.indexOf(b.key);
      const aRank = aIndex === -1 ? 999 : aIndex;
      const bRank = bIndex === -1 ? 999 : bIndex;

      if (aRank !== bRank) return aRank - bRank;

      return a.label.localeCompare(b.label);
    });
  }

  return fields;
}

function recordTitle(data: Record<string, unknown>, index: number): string {
  const databank = extractDatabank(data);

  if (databank) return databank;

  if (data.email && data.password) return "Leaked credential";
  if (data.user_id) return "Discord leak record";
  if (data.domain && data.email) return "Stealer log entry";
  if (data.username && !data.email) return "Username match";

  return `Record ${index}`;
}

function recordSubtitle(data: Record<string, unknown>): string | undefined {
  if (typeof data.email === "string") return data.email;
  if (typeof data.username === "string") return `@${data.username}`;
  if (typeof data.user_id === "string") return data.user_id;
  if (typeof data.domain === "string") return data.domain;

  return undefined;
}

function recordBadge(data: Record<string, unknown>): string | undefined {
  return extractDatabank(data) ?? undefined;
}

export function formatSearchRecords(results: unknown[]): FormattedRecord[] {
  return results
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return {
          index: index + 1,
          title: `Record ${index + 1}`,
          fields: [
            {
              key: "value",
              label: "Value",
              value: String(entry ?? ""),
            },
          ],
        };
      }

      const data = entry as Record<string, unknown>;
      const fields = buildRecordFields(data);

      if (fields.length === 0) return null;

      return {
        index: index + 1,
        title: recordTitle(data, index + 1),
        subtitle: recordSubtitle(data),
        badge: recordBadge(data),
        fields,
      };
    })
    .filter((record): record is FormattedRecord => record !== null);
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

  const record = data as Record<string, unknown>;

  if (record.ipleaks || record.ipinfo) {
    return formatIpRecords(record);
  }

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

  if (Array.isArray(record.breach_data)) {
    return formatSearchRecords(record.breach_data);
  }

  const fields = objectFields(record);

  if (fields.length === 0) return [];

  return [
    {
      index: 1,
      title: "Result",
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
    const label = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object") {
      flattenSearchData(value, label, rows);
    } else {
      rows.push({ label: humanizeKey(label.split(".").pop() ?? label), value: String(value ?? "") });
    }
  }

  return rows;
}
