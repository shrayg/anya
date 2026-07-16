import { siteConfig } from "@/config/site";

/** User-facing product name — never expose upstream provider names in the UI. */
export const PUBLIC_BRAND = siteConfig.name;

export const PUBLIC_AI_LABEL = `${siteConfig.name} AI`;

export const PUBLIC_INTEL_SOURCE = siteConfig.name;

const PROVIDER_PATTERN =
  /godseye|osintcat|breach\.?vip|breachvip|proxynova|csint\.?pro|csint|snusbase|breachbase|oathnet|seon|hackcheck|intelvault|leakosint|intelfetch|inf0sec|infodra|akula|leaksight|leakcheck|ithil|crowsint|melissa|shodan|proxynova|anya\.search|anya search|anya crypto ai|anya /gi;

/** Strip third-party provider names from strings shown to users. */
export function sanitizePublicText(text: string): string {
  if (!text) return text;

  let cleaned = text
    .replace(/GodsEye[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OsintCat[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Breach\.?vip[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachVIP[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/BreachBase[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/ProxyNova[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint\.pro[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/csint[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Snusbase[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/OathNet[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/SEON[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/HackCheck[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelVault[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakOSINT[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/IntelFetch[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Inf0Sec[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Infodra[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Akula[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakSight[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/LeakCheck[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Ithil[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Crowsint[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Melissa[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Shodan[^,.]*/gi, PUBLIC_INTEL_SOURCE)
    .replace(/Anya\.search/gi, PUBLIC_BRAND)
    .replace(/Anya [A-Za-z ]+/gi, PUBLIC_AI_LABEL)
    .replace(/Anya/gi, PUBLIC_BRAND)
    .replace(/GODSEYE_API_KEY/gi, "intelligence API key")
    .replace(/OSINTCAT_API_KEY/gi, "intelligence API key")
    .replace(/CSINT_API_KEY/gi, "intelligence API key")
    .replace(/BREACH_VIP_API_KEY/gi, "intelligence API key");

  if (PROVIDER_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(PROVIDER_PATTERN, PUBLIC_INTEL_SOURCE);
  }

  return cleaned.replace(/\s{2,}/g, " ").trim();
}

export function publicSearchError(fallback = "Search failed. Try again or contact support.") {
  return fallback;
}

export function publicServiceUnavailable() {
  return `${PUBLIC_INTEL_SOURCE} intelligence is temporarily unavailable. Contact support if this persists.`;
}
