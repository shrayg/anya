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
  if (lower.includes("csint")) return true;
  if (lower.includes("powered by")) return true;
  if (lower.includes("anya.int") && !lower.includes(" · ")) return true;
  if (lower.includes("enkidu.int") && !lower.includes(" · ")) return true;

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
    if (typeof value !== "string") continue;
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
  }

  if (!hasUsefulIntelFields(record)) {
    return null;
  }

  return record;
}

export function hasUsefulIntelFields(record: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(record)) {
    if (DATABANK_KEYS.has(key)) continue;
    if (
      /^(success|credits?|service|query|type|message|error|status|count|total)$/i.test(
        key,
      )
    ) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed || isBrandPlaceholderValue(trimmed)) continue;

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

export const DATABANK_KEYS = new Set<string>(DATABANK_FIELD_KEYS);
