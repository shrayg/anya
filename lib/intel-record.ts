import { siteConfig } from "@/config/site";

const BRAND = siteConfig.name.toLowerCase();

const INTERNAL_SOURCE_LABELS = new Set([
  BRAND,
  "anya.int",
  "anya int",
  "enkidu.int",
  "enkidu int",
  "godseye",
  "godseye.cat",
  "osintcat",
  "osint cat",
  "breach.vip",
  "breachvip",
  "breach vip",
  "breachhub",
  "breach hub",
  "breachhub.org",
  "proxynova",
  "anya.search",
  "anya",
  "intelligence",
  "csint",
  "csint.pro",
  "csint tools",
  "snusbase",
  "snus base",
  "snowfale",
  "snowflake",
  "breachbase",
  "breach base",
  "oathnet",
  "oath net",
  "hackcheck",
  "hack check",
  "leakcheck",
  "leak check",
  "seon",
  "shodan",
  "intelx",
  "intelx.io",
  "intelligence x",
  "cordcat",
  "cord.cat",
  "cord cat",
  "melissa",
  "infostealer",
  "info stealer",
  "index",
]);

/** Keys that must never title a result card or appear as a Source ad. */
const USELESS_DATABANK_LABELS = new Set([
  "source",
  "sources",
  "_source",
  "provider",
  "providers",
  "service",
  "credit",
  "credits",
  "success",
  "query",
  "type",
  "status",
  "message",
  "error",
  "result",
  "results",
  "data",
  "record",
  "records",
]);

const DATABANK_FIELD_KEYS = [
  "database",
  "databank",
  "db_name",
  "db",
  "collection",
  "breach",
  "breach_name",
  "source",
  "_source",
] as const;

/** Identity / secret fields that must never be rewritten to the product brand. */
const IDENTITY_FIELD_KEYS = new Set([
  "email",
  "username",
  "user",
  "user_id",
  "userid",
  "password",
  "pass",
  "passwd",
  "secret",
  "hash",
  "raw",
  "identifier",
  "phone",
  "ip",
  "ip_address",
  "name",
  "display_name",
  "global_name",
  "url",
  "profile",
  "profile_url",
  "profileUrl",
  "domain",
  "token",
  "uuid",
  "steam",
  "discord_id",
  "roblox_id",
  "snapchat",
  "handle",
]);

export function isInternalSourceLabel(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  if (INTERNAL_SOURCE_LABELS.has(lower)) return true;
  if (USELESS_DATABANK_LABELS.has(lower)) return true;
  if (lower.startsWith("godseye")) return true;
  if (lower.startsWith("osintcat") || lower.startsWith("osint cat"))
    return true;
  if (
    lower === "breach.vip" ||
    lower.startsWith("breachvip") ||
    lower.startsWith("breach vip")
  ) {
    return true;
  }
  if (
    lower === "breachhub.org" ||
    lower.startsWith("breachhub") ||
    lower.startsWith("breach hub")
  ) {
    return true;
  }
  if (lower.startsWith("snusbase") || lower.startsWith("breachbase"))
    return true;
  if (
    lower.startsWith("oathnet") ||
    lower.startsWith("cordcat") ||
    lower.startsWith("cord.cat")
  ) {
    return true;
  }
  if (lower.startsWith("intelx") || lower.startsWith("intelligence x"))
    return true;
  if (
    lower.startsWith("shodan") ||
    lower.startsWith("leakcheck") ||
    lower.startsWith("hackcheck")
  ) {
    return true;
  }

  // Substring brand checks are only safe on short single-line field values.
  // Multi-line IntelX/export bodies often contain rewritten provider URLs
  // ("Anya.Int") or credit footers ("Powered by …") and must not be wiped.
  const isShortField = trimmed.length <= 96 && !/[\r\n]/.test(trimmed);

  if (isShortField) {
    if (lower.includes("powered by")) return true;
    // Exact brand labels only — substring "anya.int" would wipe dump lines
    // that still mention the product after intelx.io URL scrubbing.
    if (lower === "csint" || lower === "csint tools" || lower === "csint.pro")
      return true;
    if (lower === "anya.int" || lower === "@anya.int") return true;
    if (lower === "enkidu.int" || lower === "@enkidu.int") return true;
  }

  return false;
}

/**
 * True when a field value is product/provider branding rather than real intel.
 * Catches the Snapchat bug where sanitizePublicText rewrote "GodsEye"/"csint"
 * into "Anya.Int" and the UI showed it as username/password.
 */
export function isBrandPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  if (isInternalSourceLabel(trimmed)) return true;

  // Credential-shaped brand pollution: "Anya.Int:Anya.Int" / "GodsEye:GodsEye"
  if (trimmed.includes(":")) {
    const parts = trimmed
      .split(":")
      .map((part) => part.trim())
      .filter(Boolean);

    if (
      parts.length > 0 &&
      parts.every((part) => isInternalSourceLabel(part))
    ) {
      return true;
    }
  }

  if (lower === BRAND || lower === "anya.int" || lower === "@anya.int") {
    return true;
  }

  return false;
}

export function isIdentityFieldKey(key: string): boolean {
  return (
    IDENTITY_FIELD_KEYS.has(key) || IDENTITY_FIELD_KEYS.has(key.toLowerCase())
  );
}

/** Returns the breach databank / collection name when present on a record. */
export function extractDatabank(data: Record<string, unknown>): string | null {
  for (const key of DATABANK_FIELD_KEYS) {
    const value = data[key];

    if (typeof value !== "string") continue;

    const trimmed = value.trim();

    if (!trimmed || isInternalSourceLabel(trimmed)) continue;
    if (USELESS_DATABANK_LABELS.has(trimmed.toLowerCase())) continue;

    return trimmed;
  }

  return null;
}

const ERROR_FIELD_KEY =
  /(?:^|[._-])(error|errors|err|exception|failure|failed)(?:$|[._-])/i;

const USELESS_ERROR_VALUE =
  /^(invalid\s+api\s*key|missing\s+api\s*key|unauthorized|forbidden|\[object object\]|null|undefined|n\/a|none)$/i;

function isErrorFieldKey(key: string): boolean {
  return ERROR_FIELD_KEY.test(key) || /error/i.test(key);
}

function isUselessIntelValue(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return true;
  if (USELESS_ERROR_VALUE.test(trimmed)) return true;
  if (/^\[object object\]$/i.test(trimmed)) return true;

  return isBrandPlaceholderValue(trimmed);
}

function flattenNestedField(
  key: string,
  value: Record<string, unknown>,
  into: Record<string, unknown>,
) {
  const isGeo = /geo|location|ip_/i.test(key);
  const preferred = [
    "ip",
    "query",
    "country",
    "country_name",
    "country_code",
    "city",
    "region",
    "region_name",
    "region_code",
    "isp",
    "org",
    "asn",
    "timezone",
    "latitude",
    "longitude",
    "lat",
    "lon",
  ];

  let wrote = false;

  for (const nestedKey of preferred) {
    const nestedVal = value[nestedKey];
    const outKey = isGeo ? nestedKey : `${key}_${nestedKey}`;

    if (outKey in into) continue;

    if (typeof nestedVal === "string" && nestedVal.trim()) {
      into[outKey] = nestedVal.trim();
      wrote = true;
    } else if (typeof nestedVal === "number" && Number.isFinite(nestedVal)) {
      into[outKey] = nestedVal;
      wrote = true;
    }
  }

  if (wrote) return;

  const parts: string[] = [];

  for (const [nestedKey, nestedVal] of Object.entries(value)) {
    if (typeof nestedVal === "string" && nestedVal.trim()) {
      parts.push(`${nestedKey}: ${nestedVal.trim()}`);
    } else if (
      typeof nestedVal === "number" ||
      typeof nestedVal === "boolean"
    ) {
      parts.push(`${nestedKey}: ${String(nestedVal)}`);
    }
  }

  if (parts.length > 0) {
    into[key] = parts.slice(0, 8).join(" · ");
  }
}

/**
 * Strip provider ads and brand placeholders from an intel row.
 * Returns null when nothing useful remains.
 */
export function scrubIntelRecord(
  entry: unknown,
): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const record = { ...(entry as Record<string, unknown>) };

  for (const key of DATABANK_FIELD_KEYS) {
    const value = record[key];

    if (typeof value !== "string") continue;
    if (
      isInternalSourceLabel(value) ||
      USELESS_DATABANK_LABELS.has(value.trim().toLowerCase())
    ) {
      delete record[key];
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (isErrorFieldKey(key)) {
      delete record[key];
      continue;
    }

    if (typeof value === "string") {
      if (isUselessIntelValue(value)) {
        delete record[key];
        continue;
      }

      if (!isBrandPlaceholderValue(value)) continue;

      // Never keep brand placeholders on identity/secret fields.
      if (isIdentityFieldKey(key) || DATABANK_KEYS.has(key)) {
        delete record[key];
        continue;
      }

      // Meta strings that collapsed to the brand are also useless.
      if (
        /^(source|sources|_source|provider|service|credit|credits)$/i.test(key)
      ) {
        delete record[key];
      }
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      delete record[key];
      flattenNestedField(key, value as Record<string, unknown>, record);
    }
  }

  if (!hasUsefulIntelFields(record)) {
    return null;
  }

  return record;
}

export function hasUsefulIntelFields(record: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(record)) {
    if (DATABANK_KEYS.has(key)) continue;
    if (isErrorFieldKey(key)) continue;
    if (
      /^(success|credits?|service|query|type|message|status|count|total)$/i.test(
        key,
      )
    ) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed || isUselessIntelValue(trimmed)) continue;

      return true;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return true;
    }

    if (Array.isArray(value) && value.length > 0) {
      return true;
    }
  }

  return false;
}

export function scrubIntelResults(results: unknown[]): unknown[] {
  const scrubbed: unknown[] = [];

  for (const entry of results) {
    const clean = scrubIntelRecord(entry);

    if (clean) scrubbed.push(clean);
  }

  return scrubbed;
}

function firstFingerprintField(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function normalizeFingerprintPart(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Stable merge key for intel rows across providers.
 * Collapses same email+password+site / breach id / stealer credential tuple.
 * Does NOT key on email alone — distinct passwords/sites/breaches are kept.
 */
export function intelResultFingerprint(entry: unknown): string {
  if (entry == null) return "null";
  if (typeof entry !== "object" || Array.isArray(entry)) {
    return `raw:${JSON.stringify(entry)}`;
  }

  const record = entry as Record<string, unknown>;

  const recordId = firstFingerprintField(record, [
    "id",
    "record_id",
    "recordId",
    "_id",
    "breach_id",
    "breachId",
    "entry_id",
    "entryId",
  ]);
  const database = normalizeFingerprintPart(
    firstFingerprintField(record, [
      "database",
      "databank",
      "breach",
      "breach_name",
      "dbname",
      "origin",
      "title",
      "collection",
      "source",
    ]),
  );

  // Prefer explicit record ids when present (cross-provider same dump row).
  if (recordId.length >= 6) {
    return `id:${normalizeFingerprintPart(recordId)}|${database}`;
  }

  const logId = firstFingerprintField(record, [
    "log_id",
    "logId",
    "machine_id",
    "machineId",
    "stealer_id",
    "stealerId",
    "archive_id",
    "archiveId",
  ]);
  const email = normalizeFingerprintPart(
    firstFingerprintField(record, ["email", "mail", "mail_address"]),
  );
  const username = normalizeFingerprintPart(
    firstFingerprintField(record, [
      "username",
      "user",
      "login",
      "identifier",
      "handle",
      "name",
    ]),
  );
  const password = firstFingerprintField(record, [
    "password",
    "pass",
    "passwd",
    "secret",
    "hash",
    "password_hash",
    "encrypted_password",
  ]);
  const site = normalizeFingerprintPart(
    firstFingerprintField(record, [
      "url",
      "url_str",
      "site",
      "domain",
      "host",
      "hostname",
      "origin_url",
    ]),
  );
  const phone = normalizeFingerprintPart(
    firstFingerprintField(record, ["phone", "phone_number", "mobile", "tel"]),
  );
  const ip = normalizeFingerprintPart(
    firstFingerprintField(record, ["ip", "ip_address", "ipAddress"]),
  );
  const discordId = normalizeFingerprintPart(
    firstFingerprintField(record, [
      "discord_id",
      "discordid",
      "discordId",
      "user_id",
      "userid",
    ]),
  );

  const identity = email || username || phone || ip || discordId;

  if (logId) {
    return `stealer:${normalizeFingerprintPart(logId)}|${identity}|${password}|${site}`;
  }

  // Credential / breach tuple — require more than identity alone.
  if (identity && (password || site || database)) {
    return `cred:${identity}|${password}|${site}|${database}`;
  }

  if (identity) {
    // Identity-only rows: keep distinct by remaining stable scalar fields.
    const extras = [
      firstFingerprintField(record, ["uuid", "steamid", "steamid64", "wallet"]),
      firstFingerprintField(record, ["token", "raw"]),
      firstFingerprintField(record, ["added_at", "breach_date", "date"]),
    ]
      .map(normalizeFingerprintPart)
      .filter(Boolean)
      .join("|");

    return extras
      ? `ident:${identity}|${extras}`
      : `ident:${identity}|${stableObjectFingerprint(record)}`;
  }

  return `obj:${stableObjectFingerprint(record)}`;
}

function stableObjectFingerprint(record: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const key of Object.keys(record).sort()) {
    if (key.startsWith("_")) continue;
    const value = record[key];

    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed || isBrandPlaceholderValue(trimmed)) continue;
      parts.push(`${key}=${trimmed.toLowerCase()}`);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${String(value)}`);
      continue;
    }
  }

  return parts.length > 0 ? parts.join("&") : JSON.stringify(record);
}

/** Drop exact/semantic duplicate intel rows; preserves first occurrence order. */
export function dedupeIntelResults(results: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];

  for (const entry of results) {
    const key = intelResultFingerprint(entry);

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }

  return out;
}

/**
 * Keep only rows that clearly relate to the searched query.
 * Email searches must not return unrelated logins/passwords from the same dump.
 */
export function filterIntelResultsForQuery(
  query: string,
  results: unknown[],
): unknown[] {
  const trimmed = query.trim();

  if (!trimmed || results.length === 0) return results;

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed);
  const needle = trimmed.toLowerCase();
  const localPart = isEmail ? needle.split("@")[0] : "";
  const domainPart = isEmail ? needle.split("@")[1] : "";

  const filtered: unknown[] = [];

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const record = { ...(entry as Record<string, unknown>) };

    if (Array.isArray(record.credentials)) {
      const creds = (record.credentials as unknown[]).filter((cred) => {
        if (!cred || typeof cred !== "object") return false;
        const c = cred as Record<string, unknown>;
        const blob = [
          c.email,
          c.username,
          c.login,
          c.user,
          c.url,
          c.site,
          c.domain,
        ]
          .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
          .join(" ");

        if (isEmail) {
          return (
            blob.includes(needle) ||
            (localPart.length >= 3 &&
              blob.includes(localPart) &&
              Boolean(domainPart) &&
              blob.includes(domainPart))
          );
        }

        return blob.includes(needle);
      });

      if (creds.length > 0) {
        filtered.push({ ...record, credentials: creds });
        continue;
      }
    }

    const identity = [
      record.email,
      record.username,
      record.login,
      record.user,
      record.identifier,
      record.query,
      record.phone,
      record.ip,
      record.domain,
      record.url,
      record.url_str,
      record.site,
      record.host,
      record.device_emails,
      record.device_emails_str,
      record.log_id,
      record.logId,
      record.machine_id,
      record.machineId,
      record.victim_id,
      record.victimId,
    ]
      .flatMap((v) => {
        if (typeof v === "string") return [v.toLowerCase()];
        if (Array.isArray(v)) {
          return v
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.toLowerCase());
        }

        return [];
      })
      .filter(Boolean);

    const haystack = identity.join(" ");

    if (isEmail) {
      const deep = JSON.stringify(record).toLowerCase();

      if (
        haystack.includes(needle) ||
        identity.some((v) => v === needle) ||
        (localPart.length >= 3 &&
          haystack.includes(localPart) &&
          Boolean(domainPart) &&
          haystack.includes(domainPart)) ||
        // Keep victim/machine rows where the email only appears nested
        // (credentials already filtered above; still require a real match).
        deep.includes(needle)
      ) {
        filtered.push(record);
      }
      continue;
    }

    if (haystack.includes(needle) || JSON.stringify(record).toLowerCase().includes(needle)) {
      filtered.push(record);
    }
  }

  return filtered;
}

export const DATABANK_KEYS = new Set<string>(DATABANK_FIELD_KEYS);
