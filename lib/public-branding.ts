import { siteConfig } from "@/config/site";

/** User-facing product name — never expose upstream provider names in the UI. */
export const PUBLIC_BRAND = siteConfig.name;

export const PUBLIC_AI_LABEL = `${siteConfig.name} AI`;

export const PUBLIC_INTEL_SOURCE = siteConfig.name;

/**
 * Provider / vendor tokens that must never appear in user-visible strings.
 * Keep in sync with INTERNAL_SOURCE_LABELS in intel-record.ts.
 */
const PROVIDER_PATTERN =
  /godseye(?:\.cat)?|osintcat|osint\s*cat|breach\.?vip|breachvip|breach\s*vip|breachhub|breach\s*hub|proxynova|csint\.?pro|csint(?:\s+tools)?|snusbase|snus\s*base|snowfale|breachbase|breach\s*base|oathnet|oath\s*net|seon|hackcheck|hack\s*check|intelvault|leakosint|intelfetch|inf0sec|infodra|akula|leaksight|leakcheck|leak\s*check|ithil|crowsint|melissa|shodan|cord\.?cat|cordcat|intelx(?:\.io)?|intelligence\s*x|infostealer|info\s*stealer|hudsonrock|hudson\s*rock|xosint|seekria|seeknow|see-?know|room\s*101|room101|anya\.search|anya search|anya crypto ai|anya /gi;

const POWERED_BY_PROVIDER =
  /powered\s+by\s+(?:csint(?:\.pro)?(?:\s+tools)?|godseye|osintcat|shodan|intelx|oathnet|snusbase|breachvip|breachhub|breachbase|seon|cordcat|leakcheck|hackcheck)[^,.\n]*/gi;

function stripProviderNames(text: string): string {
  let cleaned = text
    .replace(POWERED_BY_PROVIDER, `Powered by ${PUBLIC_BRAND}`)
    .replace(
      /powered\s+by\s+csint(?:\.pro)?(?:\s+tools)?/gi,
      `Powered by ${PUBLIC_BRAND}`,
    )
    .replace(/GodsEye[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OsintCat[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OSINT\s*Cat[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\.?vip[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachVIP[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\s*VIP[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachHub[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\s*Hub[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/breachhub\.org[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachBase[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\s*Base[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/ProxyNova[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint\.pro[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint(?:\s+tools)?[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Snusbase[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Snus\s*Base[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Snowfale[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    // Never show "snowflake" in UI — Discord IDs or provider brand alike.
    .replace(/Discord\s+snowflake\s+IDs?/gi, "Discord ID")
    .replace(/\bsnowflake\s+IDs?\b/gi, "Discord ID")
    .replace(/\blinked\s+Discord\s+snowflake\b/gi, "linked Discord ID")
    .replace(/\bSnowflake\b/gi, PUBLIC_INTEL_SOURCE)
    .replace(/\bsnowflakes?\b/gi, "")
    .replace(/OathNet[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Oath\s*Net[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/SEON[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/HackCheck[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Hack\s*Check[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelVault[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakOSINT[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelFetch[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Inf0Sec[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Infodra[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Akula[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakSight[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakCheck[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Leak\s*Check[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Ithil[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Crowsint[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Melissa[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Shodan[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/CordCat[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/cord\.cat[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Intelligence\s*X\b/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelX(?:\.io)?\b/gi, PUBLIC_INTEL_SOURCE)
    .replace(/intelx\.io(?:\/[^\s,;)\]}]*)?/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Infostealer[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Info\s*stealer[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Room\s*101[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Anya\.search/gi, PUBLIC_BRAND)
    .replace(/Anya [A-Za-z ]+/gi, PUBLIC_AI_LABEL)
    // Keep Anya.Int intact — bare "Anya" only.
    .replace(/Anya(?!\.Int\b)/gi, PUBLIC_BRAND)
    .replace(/GODSEYE_API_KEY/gi, "intelligence API key")
    .replace(/OSINTCAT_API_KEY/gi, "intelligence API key")
    .replace(/CSINT_API_KEY/gi, "intelligence API key")
    .replace(/BREACH_VIP_API_KEY/gi, "intelligence API key")
    .replace(/BREACHHUB_API_KEY/gi, "intelligence API key")
    .replace(/SNUSBASE_API_KEY/gi, "intelligence API key")
    .replace(/ROOM101_API_KEY/gi, "intelligence API key")
    .replace(/OATHNET_API_KEY/gi, "intelligence API key")
    .replace(/SHODAN_API_KEY/gi, "intelligence API key")
    .replace(/INTELX_API_KEY/gi, "intelligence API key")
    .replace(/CORDCAT_API_KEY/gi, "intelligence API key")
    .replace(/SEON_API_KEY/gi, "intelligence API key");

  // Reset lastIndex — PROVIDER_PATTERN is global and shared.
  PROVIDER_PATTERN.lastIndex = 0;
  if (PROVIDER_PATTERN.test(cleaned)) {
    PROVIDER_PATTERN.lastIndex = 0;
    cleaned = cleaned.replace(PROVIDER_PATTERN, PUBLIC_INTEL_SOURCE);
  }

  return cleaned;
}

/** Strip third-party provider names from short strings shown to users. */
export function sanitizePublicText(text: string): string {
  if (!text) return text;

  const original = text.trim();
  const cleaned = stripProviderNames(text)
    .replace(/\s{2,}/g, " ")
    .trim();

  // Provider-only strings must not become the product brand (fake credentials / Source ads).
  if (
    cleaned.toLowerCase() === PUBLIC_INTEL_SOURCE.toLowerCase() &&
    original.toLowerCase() !== PUBLIC_INTEL_SOURCE.toLowerCase()
  ) {
    return "";
  }

  return cleaned;
}

/**
 * Sanitize multi-line export bodies (IntelX / storage dumps, raw downloads)
 * without collapsing whitespace / newlines.
 */
export function sanitizePublicContent(text: string): string {
  if (!text) return text;

  const cleaned = stripProviderNames(text);
  const trimmed = cleaned.trim();

  if (
    trimmed.toLowerCase() === PUBLIC_INTEL_SOURCE.toLowerCase() &&
    text.trim().toLowerCase() !== PUBLIC_INTEL_SOURCE.toLowerCase()
  ) {
    return "";
  }

  return cleaned;
}

export function publicSearchError(
  fallback = "Search failed. Try again or contact support.",
) {
  return fallback;
}

export function publicServiceUnavailable() {
  return `${PUBLIC_INTEL_SOURCE} intelligence is temporarily unavailable. Contact support if this persists.`;
}
