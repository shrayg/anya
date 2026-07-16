import { siteConfig } from "@/config/site";

/** User-facing product name — never expose upstream provider names in the UI. */
export const PUBLIC_BRAND = siteConfig.name;

export const PUBLIC_AI_LABEL = `${siteConfig.name} AI`;

export const PUBLIC_INTEL_SOURCE = siteConfig.name;

const PROVIDER_PATTERN =
  /godseye|osintcat|breach\.?vip|breachvip|proxynova|csint\.?pro|csint(?:\s+tools)?|snusbase|breachbase|oathnet|seon|hackcheck|intelvault|leakosint|intelfetch|inf0sec|infodra|akula|leaksight|leakcheck|ithil|crowsint|melissa|shodan|proxynova|anya\.search|anya search|anya crypto ai|anya /gi;

const POWERED_BY_CSINT =
  /powered\s+by\s+csint(?:\.pro)?(?:\s+tools)?/gi;

function stripProviderNames(text: string): string {
  let cleaned = text
    .replace(POWERED_BY_CSINT, `Powered by ${PUBLIC_BRAND}`)
    .replace(/GodsEye[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OsintCat[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\.?vip[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachVIP[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachBase[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/ProxyNova[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint\.pro[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint(?:\s+tools)?[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Snusbase[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OathNet[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/SEON[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/HackCheck[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelVault[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakOSINT[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelFetch[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Inf0Sec[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Infodra[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Akula[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakSight[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakCheck[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Ithil[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Crowsint[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Melissa[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Shodan[^,.\n]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Anya\.search/gi, PUBLIC_BRAND)
    .replace(/Anya [A-Za-z ]+/gi, PUBLIC_AI_LABEL)
    // Keep Anya.Int intact — bare "Anya" only.
    .replace(/Anya(?!\.Int\b)/gi, PUBLIC_BRAND)
    .replace(/GODSEYE_API_KEY/gi, "intelligence API key")
    .replace(/OSINTCAT_API_KEY/gi, "intelligence API key")
    .replace(/CSINT_API_KEY/gi, "intelligence API key")
    .replace(/BREACH_VIP_API_KEY/gi, "intelligence API key");

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

  return stripProviderNames(text).replace(/\s{2,}/g, " ").trim();
}

/**
 * Sanitize multi-line export bodies (IntelX dumps, raw downloads)
 * without collapsing whitespace / newlines.
 */
export function sanitizePublicContent(text: string): string {
  if (!text) return text;
  return stripProviderNames(text);
}

export function publicSearchError(fallback = "Search failed. Try again or contact support.") {
  return fallback;
}

export function publicServiceUnavailable() {
  return `${PUBLIC_INTEL_SOURCE} intelligence is temporarily unavailable. Contact support if this persists.`;
}
