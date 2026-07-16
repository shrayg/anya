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
  "proxynova",
  "anya.search",
  "anya",
  "intelligence",
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

export function isInternalSourceLabel(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  if (INTERNAL_SOURCE_LABELS.has(lower)) return true;
  if (lower.startsWith("godseye")) return true;
  if (lower.startsWith("osintcat")) return true;
  if (lower === "breach.vip" || lower.startsWith("breachvip")) return true;
  if (lower.includes("csint")) return true;
  if (lower.includes("anya.int") && !lower.includes(" · ")) return true;
  if (lower.includes("enkidu.int") && !lower.includes(" · ")) return true;

  return false;
}

/** Returns the breach databank / collection name when present on a record. */
export function extractDatabank(data: Record<string, unknown>): string | null {
  for (const key of DATABANK_FIELD_KEYS) {
    const value = data[key];

    if (typeof value !== "string") continue;

    const trimmed = value.trim();

    if (!trimmed || isInternalSourceLabel(trimmed)) continue;

    return trimmed;
  }

  return null;
}

export const DATABANK_KEYS = new Set<string>(DATABANK_FIELD_KEYS);
