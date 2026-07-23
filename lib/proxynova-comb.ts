import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { isBrandPlaceholderValue } from "@/lib/intel-record";

export type CombCredentialField = {
  key: string;
  label: string;
  value: string;
};

export type CombCredential = {
  identifier: string;
  secret: string;
  raw: string;
  /** Connected fields from the hit (username, phone, domain, …) beyond login/secret. */
  fields?: CombCredentialField[];
};

export type CombSearchResult = {
  source: string;
  query: string;
  totalMatches: number;
  returned: number;
  start: number;
  credentials: CombCredential[];
  message?: string;
};

/** Identity / context keys to surface beside the primary login + secret. */
const CONNECTED_FIELD_SPECS: { keys: string[]; label: string }[] = [
  { keys: ["email", "mail", "e_mail"], label: "Email" },
  { keys: ["username", "user", "login", "handle", "screen_name"], label: "Username" },
  { keys: ["phone", "phone_number", "mobile", "number", "tel"], label: "Phone" },
  { keys: ["domain", "site", "website"], label: "Domain" },
  { keys: ["url", "profile", "profile_url", "profileUrl"], label: "URL" },
  { keys: ["ip", "ip_address", "lastip", "last_ip"], label: "IP" },
  { keys: ["name", "full_name", "fullname", "display_name", "global_name"], label: "Name" },
  { keys: ["address", "street", "street_address"], label: "Address" },
  { keys: ["city"], label: "City" },
  { keys: ["state", "region", "province"], label: "State" },
  { keys: ["zip", "zipcode", "postal_code", "postcode"], label: "ZIP" },
  { keys: ["dob", "date_of_birth", "birthdate", "birthday"], label: "DOB" },
  { keys: ["country", "country_code", "countryCode"], label: "Country" },
  { keys: ["discord_id", "discordid", "discord"], label: "Discord ID" },
  { keys: ["roblox_id", "robloxid", "roblox"], label: "Roblox ID" },
  { keys: ["steam", "steamid", "steam_id"], label: "Steam" },
  { keys: ["hash", "password_hash", "encrypted_password"], label: "Hash" },
  { keys: ["password", "pass", "passwd"], label: "Password" },
  {
    keys: ["database", "dbname", "db_name", "breach", "breach_name", "origin", "title", "collection"],
    label: "Breach",
  },
];

function stringFromRecord(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const raw = record[key];

    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }

  return "";
}

/**
 * Pull connected identity fields from a breach/combo/datavoid row so the UI
 * can show username/phone/domain/etc. alongside the primary login + secret.
 */
export function connectedFieldsFromBreachRecord(
  record: Record<string, unknown>,
  opts: { identifier?: string; secret?: string } = {},
): CombCredentialField[] {
  const skipValues = new Set(
    [opts.identifier, opts.secret]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim().toLowerCase()),
  );
  const seenKeys = new Set<string>();
  const fields: CombCredentialField[] = [];

  for (const spec of CONNECTED_FIELD_SPECS) {
    const value = stringFromRecord(record, spec.keys);

    if (!value || isBrandPlaceholderValue(value)) continue;

    const normalized = value.toLowerCase();

    if (skipValues.has(normalized)) continue;

    const key = spec.keys[0]!;

    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Password/hash already shown as the primary secret — skip duplicate.
    if (
      (key === "password" || key === "hash") &&
      opts.secret &&
      opts.secret.trim().toLowerCase() === normalized
    ) {
      continue;
    }

    fields.push({ key, label: spec.label, value });
  }

  return fields;
}

export function mergeCombCredentialFields(
  primary?: CombCredentialField[],
  secondary?: CombCredentialField[],
): CombCredentialField[] | undefined {
  if (!primary?.length && !secondary?.length) return undefined;

  const seen = new Set<string>();
  const merged: CombCredentialField[] = [];

  for (const field of [...(primary ?? []), ...(secondary ?? [])]) {
    const dedupe = `${field.key}\0${field.value.toLowerCase()}`;

    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    merged.push(field);
  }

  return merged.length > 0 ? merged : undefined;
}

export function parseCombLine(line: string): CombCredential {
  const trimmed = line.trim();

  if (!trimmed) {
    return { identifier: "", secret: "", raw: trimmed };
  }

  if (trimmed.includes("\t")) {
    const [identifier = "", secret = ""] = trimmed.split("\t");

    return { identifier, secret, raw: trimmed };
  }

  const colon = trimmed.indexOf(":");

  if (colon === -1) {
    return { identifier: trimmed, secret: "", raw: trimmed };
  }

  return {
    identifier: trimmed.slice(0, colon),
    secret: trimmed.slice(colon + 1),
    raw: trimmed,
  };
}

export function getEmailDomain(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");

  if (at <= 0 || at === trimmed.length - 1) return null;

  return trimmed.slice(at + 1);
}

export function credentialMatchesDomain(
  identifier: string,
  domain: string,
): boolean {
  const target = domain.toLowerCase();
  const emailDomain = getEmailDomain(identifier);

  if (!emailDomain) return false;

  return emailDomain === target || emailDomain.endsWith(`.${target}`);
}

export function filterCredentialsForDomain(
  credentials: CombCredential[],
  domain: string,
): CombCredential[] {
  return credentials.filter((row) =>
    credentialMatchesDomain(row.identifier, domain),
  );
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function credentialMatchesEmail(
  identifier: string,
  email: string,
): boolean {
  return identifier.trim().toLowerCase() === email.toLowerCase();
}

export function filterCredentialsForEmail(
  credentials: CombCredential[],
  email: string,
): CombCredential[] {
  return credentials.filter((row) =>
    credentialMatchesEmail(row.identifier, email),
  );
}

export async function searchProxynovaCombForEmail(
  email: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const raw = await searchProxynovaComb(email, options);
  const credentials = filterCredentialsForEmail(raw.credentials, email);

  return {
    ...raw,
    query: email,
    source: "Breached Data",
    totalMatches: credentials.length,
    returned: credentials.length,
    credentials,
  };
}

export async function searchProxynovaCombForDomain(
  domain: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const raw = await searchProxynovaComb(domain, options);
  const credentials = filterCredentialsForDomain(raw.credentials, domain);

  return {
    ...raw,
    query: domain,
    source: "Breached Data",
    totalMatches: credentials.length,
    returned: credentials.length,
    credentials,
  };
}

export async function searchProxynovaComb(
  query: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const start = Math.max(0, options?.start ?? 0);
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 100);

  const url = new URL("https://api.proxynova.com/comb");

  url.searchParams.set("query", query);
  url.searchParams.set("start", String(start));
  url.searchParams.set("limit", String(limit));

  const res = await fetchWithTimeout(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    timeoutMs: 20_000,
  });

  if (res.status === 429) {
    throw new Error(
      "Rate limited — ProxyNova allows about 100 requests per minute.",
    );
  }

  if (!res.ok) {
    throw new Error(`ProxyNova COMB returned ${res.status}`);
  }

  const data = (await res.json()) as { count?: number; lines?: string[] };
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const credentials = lines
    .map(parseCombLine)
    .filter((row) => row.identifier || row.secret);

  return {
    source: "Breached Data",
    query,
    totalMatches:
      typeof data.count === "number" ? data.count : credentials.length,
    returned: credentials.length,
    start,
    credentials,
  };
}
