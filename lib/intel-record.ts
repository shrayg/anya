import { siteConfig } from "@/config/site";
import {
  filterBlacklistedRecords,
  getCachedBlacklistSet,
} from "@/lib/data-blacklist";

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
  "propertyradar",
  "property radar",
  "infostealer",
  "info stealer",
  "room101",
  "room 101",
  "wentyn",
  "memory",
  "memory.lol",
  "memorylol",
  "nbrs",
  "reconly",
  "leaksight",
  "nosint",
  "binlist",
  "datavoid",
  "hudsonrock",
  "github",
  "checko",
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
    if (lower === "anya" || lower === "@anya") return true;
    if (lower === "anyaint" || lower === "@anyaint") return true;
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

function setIfEmpty(
  into: Record<string, unknown>,
  outKey: string,
  raw: unknown,
): boolean {
  if (outKey in into && into[outKey] != null && into[outKey] !== "") {
    return false;
  }

  if (typeof raw === "string" && raw.trim()) {
    into[outKey] = raw.trim();

    return true;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    into[outKey] = raw;

    return true;
  }

  return false;
}

/**
 * Nested stealer/victim envelopes often carry browseable log / machine ids.
 * Lift those to canonical top-level keys instead of collapsing to
 * `"id: … · machine_id: …"` blobs that Machine view cannot parse.
 */
function flattenStealerMetaField(
  key: string,
  value: Record<string, unknown>,
  into: Record<string, unknown>,
): boolean {
  if (
    !/^(log|victim|device|machine|archive|infection|stealer_?log)$/i.test(key)
  ) {
    return false;
  }

  let wrote = false;

  const logKeys = [
    "log_id",
    "logId",
    "victim_id",
    "victimId",
    "doc_id",
    "docId",
    "import_id",
    "importId",
    "id",
  ] as const;
  const machineKeys = [
    "machine_id",
    "machineId",
    "hwid",
    "uuid",
    "_id",
  ] as const;
  const labelKeys = [
    "hostname",
    "computer_name",
    "computerName",
    "os",
    "malware",
    "stealer",
    "country",
    "date",
  ] as const;

  for (const nestedKey of logKeys) {
    const nestedVal = value[nestedKey];
    const outKey =
      nestedKey === "logId" || nestedKey === "id"
        ? "log_id"
        : nestedKey === "victimId"
          ? "victim_id"
          : nestedKey === "docId"
            ? "doc_id"
            : nestedKey === "importId"
              ? "import_id"
              : nestedKey;

    if (setIfEmpty(into, outKey, nestedVal)) {
      wrote = true;
    }
  }

  for (const nestedKey of machineKeys) {
    const outKey =
      nestedKey === "machineId"
        ? "machine_id"
        : nestedKey === "_id"
          ? "_id"
          : nestedKey;

    if (setIfEmpty(into, outKey, value[nestedKey])) {
      wrote = true;
    }
  }

  for (const nestedKey of labelKeys) {
    if (setIfEmpty(into, nestedKey, value[nestedKey])) {
      wrote = true;
    }
  }

  return wrote;
}

function flattenNestedField(
  key: string,
  value: Record<string, unknown>,
  into: Record<string, unknown>,
) {
  const isGeo = /geo|location|ip_/i.test(key);
  const isProfileLike =
    /^(discord_?profile|profile|user|osint_?data|medal|database_?leaks)$/i.test(
      key,
    );
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
    "email",
    "phone",
    "username",
    "user_id",
    "discord_id",
    "password",
    "token",
  ];

  let wrote = false;

  if (flattenStealerMetaField(key, value, into)) {
    return;
  }

  // Lift geo / profile nested scalars into structured top-level fields instead
  // of dumping a JSON-ish "key: value · …" blob.
  if (isGeo || isProfileLike) {
    for (const [nestedKey, nestedVal] of Object.entries(value)) {
      if (nestedVal == null || nestedVal === "") continue;

      if (
        typeof nestedVal === "string" ||
        typeof nestedVal === "number" ||
        typeof nestedVal === "boolean"
      ) {
        const bareFree =
          !(nestedKey in into) ||
          into[nestedKey] == null ||
          into[nestedKey] === "";
        const outKey = isGeo || bareFree ? nestedKey : `${key}_${nestedKey}`;

        if (outKey in into && into[outKey] != null && into[outKey] !== "") {
          continue;
        }

        into[outKey] =
          typeof nestedVal === "string" ? nestedVal.trim() : nestedVal;
        wrote = true;
        continue;
      }

      if (isPlainIntelObject(nestedVal) && /geo|location|ip_/i.test(nestedKey)) {
        flattenNestedField(nestedKey, nestedVal, into);
        wrote = true;
      }
    }

    if (wrote) return;
  }

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
  // Provider rate-limit / abuse envelopes must never become result cards.
  const limitBlob = [record.reason, record.message, record.error]
    .map((v) => (typeof v === "string" ? v : ""))
    .join(" ")
    .toLowerCase();

  if (
    limitBlob.includes("rate limit") ||
    limitBlob.includes("temporarily blocked") ||
    limitBlob.includes("abuse detected") ||
    (record.data_found === false &&
      (record.retry_after_seconds != null || record.retry_after != null))
  ) {
    return false;
  }

  for (const [key, value] of Object.entries(record)) {
    if (DATABANK_KEYS.has(key)) continue;
    if (isErrorFieldKey(key)) continue;
    if (
      /^(success|credits?|service|query|type|message|status|count|total|data_found|reason|retry_after(?:_seconds)?)$/i.test(
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

  const blacklist = getCachedBlacklistSet();

  if (blacklist.size === 0) return scrubbed;

  return filterBlacklistedRecords(scrubbed, blacklist);
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

function looksLikeDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

function looksLikeDumpFilename(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return false;

  return /\.(txt|csv|sql|json|tsv|log|db|zip|rar|7z)$/i.test(trimmed);
}

function asFingerprintRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function isPlainIntelObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nestedFingerprintField(
  record: Record<string, unknown>,
  path: Array<string | string[]>,
): string {
  let current: unknown = record;

  for (const step of path) {
    const obj = asFingerprintRecord(current);

    if (!obj) return "";

    if (Array.isArray(step)) {
      current = firstFingerprintField(obj, step) || undefined;
      continue;
    }

    current = obj[step];
  }

  if (typeof current === "string" && current.trim()) return current.trim();
  if (typeof current === "number" && Number.isFinite(current)) {
    return String(current);
  }

  return "";
}

function extractFingerprintDiscordId(record: Record<string, unknown>): string {
  const direct = firstFingerprintField(record, [
    "discord_id",
    "discordid",
    "discordId",
    "user_id",
    "userid",
  ]);

  if (direct && looksLikeDiscordSnowflake(direct)) {
    return normalizeFingerprintPart(direct);
  }

  const id = firstFingerprintField(record, ["id"]);

  if (id && looksLikeDiscordSnowflake(id)) {
    return normalizeFingerprintPart(id);
  }

  for (const key of [
    "discord_profile",
    "discordProfile",
    "profile",
    "user",
    "discord",
  ]) {
    const nested = asFingerprintRecord(record[key]);

    if (!nested) continue;

    const nestedId = firstFingerprintField(nested, [
      "discord_id",
      "discordId",
      "user_id",
      "userid",
      "id",
    ]);

    if (nestedId && looksLikeDiscordSnowflake(nestedId)) {
      return normalizeFingerprintPart(nestedId);
    }
  }

  return "";
}

function extractFingerprintIp(record: Record<string, unknown>): string {
  const direct = firstFingerprintField(record, [
    "ip",
    "ip_address",
    "ipAddress",
    "query",
  ]);

  if (direct) return normalizeFingerprintPart(direct);

  const fromOsint = nestedFingerprintField(record, [
    "osint_data",
    ["ip", "ip_address", "ipAddress"],
  ]);

  if (fromOsint) return normalizeFingerprintPart(fromOsint);

  const fromGeo = nestedFingerprintField(record, [
    "ip_geolocation",
    ["query", "ip", "ip_address"],
  ]);

  if (fromGeo) return normalizeFingerprintPart(fromGeo);

  const fromGeoCamel = nestedFingerprintField(record, [
    "ipGeolocation",
    ["query", "ip", "ipAddress"],
  ]);

  if (fromGeoCamel) return normalizeFingerprintPart(fromGeoCamel);

  return "";
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
  const ip = extractFingerprintIp(record);
  const discordId = extractFingerprintDiscordId(record);

  // Discord snowflakes often land in `id` — do not treat them as unique dump
  // row ids keyed by BREACHES.TXT vs RESTORECORD.CSV (same person, eight cards).
  const stableRecordId =
    recordId &&
    !(
      looksLikeDiscordSnowflake(recordId) &&
      (!discordId || discordId === normalizeFingerprintPart(recordId))
    )
      ? recordId
      : "";

  // Prefer explicit record ids when present (cross-provider same dump row).
  if (stableRecordId.length >= 6) {
    return `id:${normalizeFingerprintPart(stableRecordId)}|${database}`;
  }

  const identity = email || username || phone || ip || discordId;

  if (logId) {
    return `stealer:${normalizeFingerprintPart(logId)}|${identity}|${password}|${site}`;
  }

  // Discord / IP leak rows often repeat across dump filenames. Key on
  // identity+ip (+ password when present), not the dump title / sparse wrapper.
  if (discordId && !site) {
    return `discord:${discordId}|${ip}|${password}`;
  }

  if (ip && !password && !site && (discordId || username || email)) {
    return `iphit:${ip}|${discordId || username || email}`;
  }

  const databaseKey =
    database && !looksLikeDumpFilename(database) ? database : "";

  // Credential / breach tuple — require more than identity alone.
  if (identity && (password || site || databaseKey)) {
    return `cred:${identity}|${password}|${site}|${databaseKey}`;
  }

  if (identity) {
    // Identity-only rows: keep distinct by remaining stable scalar fields.
    // Ignore dump/filename-style databases and indexed dates so near-identical
    // leak rows merge (richer row wins in dedupeIntelResults).
    const extras = [
      firstFingerprintField(record, ["uuid", "steamid", "steamid64", "wallet"]),
      firstFingerprintField(record, ["token", "raw"]),
      ip,
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

function intelRowRichness(entry: unknown): number {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return 0;
  const record = entry as Record<string, unknown>;
  let score = 0;

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("_") || value == null || value === "") continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      score += 1;
      continue;
    }
    if (typeof value === "object") score += 3;
  }

  return score;
}

/** Merge two intel rows field-wise; prefers non-empty values from `preferred`. */
export function mergeIntelRecordFields(
  base: unknown,
  preferred: unknown,
): unknown {
  if (!isPlainIntelObject(base)) return preferred ?? base;
  if (!isPlainIntelObject(preferred)) return base;

  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(preferred)) {
    if (value == null || value === "") continue;

    const existing = out[key];

    if (existing == null || existing === "") {
      out[key] = value;
      continue;
    }

    if (isPlainIntelObject(existing) && isPlainIntelObject(value)) {
      out[key] = mergeIntelRecordFields(existing, value);
      continue;
    }

    if (
      typeof existing === "string" &&
      typeof value === "string" &&
      existing.trim().toLowerCase() === value.trim().toLowerCase()
    ) {
      continue;
    }

    // Prefer the longer / more informative scalar when both exist.
    if (typeof existing === "string" && typeof value === "string") {
      if (value.trim().length > existing.trim().length) out[key] = value;
    }
  }

  return out;
}

function discordSoftGroupKey(entry: unknown): string {
  if (!isPlainIntelObject(entry)) return `raw:${String(entry)}`;

  const discordId = extractFingerprintDiscordId(entry);
  const email = normalizeFingerprintPart(
    firstFingerprintField(entry, ["email", "mail", "mail_address"]),
  );
  const password = firstFingerprintField(entry, [
    "password",
    "pass",
    "passwd",
    "secret",
    "hash",
    "password_hash",
    "encrypted_password",
  ]);
  const site = normalizeFingerprintPart(
    firstFingerprintField(entry, [
      "url",
      "url_str",
      "site",
      "domain",
      "host",
      "hostname",
      "origin_url",
    ]),
  );

  // Same Discord ID + credential (+ optional site) collapses near-identical
  // dump wrappers even when IP / filename / nested profile chrome differs.
  return `soft:${discordId}|${email}|${normalizeFingerprintPart(password)}|${site}`;
}

function isDiscordProfileNoiseRow(entry: unknown): boolean {
  if (!isPlainIntelObject(entry)) return false;

  const leakKeys =
    /^(email|mail|password|pass|passwd|secret|hash|ip|ip_address|phone|token|domain|url|site|host|login)$/i;

  for (const [key, value] of Object.entries(entry)) {
    if (!leakKeys.test(key)) continue;
    if (value == null || value === "") continue;
    if (typeof value === "string" && !value.trim()) continue;

    return false;
  }

  const keys = Object.keys(entry).filter(
    (key) =>
      !key.startsWith("_") &&
      !DATABANK_KEYS.has(key) &&
      !/^(source|sources|provider|success|status|count|total)$/i.test(key),
  );

  if (keys.length === 0) return true;

  return keys.every((key) =>
    /^(user_?id|discord_?id|id|username|user|global_?name|display_?name|avatar|banner|bio|about|discriminator|accent|clan|nitro|badges?|flags?|created|member_?since|name)$/i.test(
      key,
    ),
  );
}

/**
 * Soft-merge Discord leak rows that share identity+password but differ only by
 * missing IP / dump filename wrappers — fewer near-duplicate cards.
 */
function softMergeDiscordNearDupes(results: unknown[]): unknown[] {
  const groups = new Map<
    string,
    { withIp: Map<string, { entry: unknown; order: number }>; noIp: unknown[]; order: number }
  >();

  results.forEach((entry, order) => {
    if (!isPlainIntelObject(entry) || !extractFingerprintDiscordId(entry)) {
      const key = `keep:${order}`;
      groups.set(key, {
        withIp: new Map(),
        noIp: [entry],
        order,
      });
      return;
    }

    const softKey = discordSoftGroupKey(entry);
    const ip = extractFingerprintIp(entry);
    const group = groups.get(softKey) ?? {
      withIp: new Map<string, { entry: unknown; order: number }>(),
      noIp: [] as unknown[],
      order,
    };

    if (!ip) {
      group.noIp.push(entry);
    } else {
      const prev = group.withIp.get(ip);

      group.withIp.set(ip, {
        entry: prev ? mergeIntelRecordFields(prev.entry, entry) : entry,
        order: prev?.order ?? order,
      });
    }

    groups.set(softKey, group);
  });

  const out: { entry: unknown; order: number }[] = [];

  for (const group of groups.values()) {
    let noIpMerged: unknown | null = null;

    for (const row of group.noIp) {
      noIpMerged = noIpMerged
        ? mergeIntelRecordFields(noIpMerged, row)
        : row;
    }

    if (group.withIp.size === 0) {
      if (noIpMerged) out.push({ entry: noIpMerged, order: group.order });
      continue;
    }

    const ipRows = [...group.withIp.values()];

    if (noIpMerged) {
      let bestIdx = 0;
      let bestScore = intelRowRichness(ipRows[0]?.entry);

      for (let i = 1; i < ipRows.length; i++) {
        const score = intelRowRichness(ipRows[i]?.entry);

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      ipRows[bestIdx] = {
        ...ipRows[bestIdx],
        entry: mergeIntelRecordFields(ipRows[bestIdx].entry, noIpMerged),
      };
    }

    for (const row of ipRows) out.push(row);
  }

  return out.sort((a, b) => a.order - b.order).map((item) => item.entry);
}

/** Drop exact/semantic duplicate intel rows; merges fields per key (richer wins ties). */
export function dedupeIntelResults(results: unknown[]): unknown[] {
  const best = new Map<
    string,
    { entry: unknown; richness: number; order: number }
  >();

  results.forEach((entry, order) => {
    const key = intelResultFingerprint(entry);
    const richness = intelRowRichness(entry);
    const prev = best.get(key);

    if (!prev) {
      best.set(key, { entry, richness, order });
      return;
    }

    const merged =
      richness >= prev.richness
        ? mergeIntelRecordFields(prev.entry, entry)
        : mergeIntelRecordFields(entry, prev.entry);

    best.set(key, {
      entry: merged,
      richness: Math.max(richness, prev.richness),
      order: prev.order,
    });
  });

  return [...best.values()]
    .sort((a, b) => a.order - b.order)
    .map((item) => item.entry);
}

/**
 * Discord ID search consolidation — scrub, dedupe, soft-merge near-dupes, and
 * drop profile-chrome rows that only mirror the left-hand profile panel.
 */
export function consolidateDiscordLeakResults(
  results: unknown[],
  discordId: string,
): unknown[] {
  const id = discordId.trim();

  if (results.length === 0) return [];

  const normalized = scrubIntelResults(results).map((entry) => {
    if (!isPlainIntelObject(entry)) return entry;

    const row = { ...entry };

    if (!extractFingerprintDiscordId(row) && id) {
      row.user_id = id;
    }

    return row;
  });

  const deduped = softMergeDiscordNearDupes(dedupeIntelResults(normalized));
  const withoutNoise = deduped.filter(
    (entry) => !isDiscordProfileNoiseRow(entry),
  );

  // Keep at least something if every row was profile chrome.
  return withoutNoise.length > 0 ? withoutNoise : deduped;
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
