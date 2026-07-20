/**
 * Crypto Intel suite kill-switch.
 *
 * Disable entire Crypto Intel suite: set CRYPTO_INTEL_ENABLED=0
 * (and NEXT_PUBLIC_CRYPTO_INTEL=0 if used client-side).
 *
 * Defaults ON so the suite is tryable out of the box. When off, catalog
 * entries, dashboard routes, nav, and API handlers for Crypto Intel hide.
 *
 * To remove the feature entirely later: delete `lib/crypto-intel/`,
 * `app/api/osint/crypto-{address,tx,risk,flow}/`, crypto-intel UI components,
 * and the "Crypto Intel" section registration in `lib/search-modules.ts`.
 */

function envFlagOff(value: string | undefined): boolean {
  if (value == null || value === "") return false;
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "off" ||
    normalized === "no"
  );
}

/** Crypto Intel is on by default. Opt out via env flags above. */
export function isCryptoIntelEnabled(): boolean {
  if (envFlagOff(process.env.CRYPTO_INTEL_ENABLED)) return false;
  if (envFlagOff(process.env.NEXT_PUBLIC_CRYPTO_INTEL)) return false;

  return true;
}

export const CRYPTO_INTEL_SECTION_TITLE = "Crypto Intel";

export const CRYPTO_INTEL_MODULE_SLUGS = new Set([
  "crypto-address",
  "crypto-tx",
  "crypto-risk",
  "crypto-flow",
  "crypto-holders",
  "crypto-cex-flows",
  "crypto-social",
  "crypto-bridge",
]);

export function isCryptoIntelSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;

  return CRYPTO_INTEL_MODULE_SLUGS.has(slug.toLowerCase());
}
