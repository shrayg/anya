/**
 * Crypto Intel suite kill-switch.
 *
 * Disable entire Crypto Intel suite: set CRYPTO_INTEL_ENABLED=0
 * (and NEXT_PUBLIC_CRYPTO_INTEL=0 if used client-side).
 *
 * Defaults ON so the suite is tryable out of the box.
 *
 * When ON: unified Crypto Intel module (+ roadmap stubs) under Crypto Intel.
 * When OFF: suite hides; legacy crypto-wallet / crypto-ai fall back to
 * Financial & Assets / AI Intelligence if still registered.
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

/** Unified module slug — all wallet/tx tools live here as submodules. */
export const CRYPTO_INTEL_UNIFIED_SLUG = "crypto-intel";

/** Old per-tool slugs → tool id on the unified module. */
export const CRYPTO_INTEL_LEGACY_TOOL_BY_SLUG: Record<string, string> = {
  "crypto-wallet": "wallet",
  "crypto-address": "address",
  "crypto-tx": "tx",
  "crypto-risk": "risk",
  "crypto-flow": "flow",
  "crypto-ai": "ai",
  "crypto-full": "full",
};

/** Suite modules — hidden from catalog/routes when Crypto Intel is off. */
export const CRYPTO_INTEL_MODULE_SLUGS = new Set([
  CRYPTO_INTEL_UNIFIED_SLUG,
  "crypto-address",
  "crypto-tx",
  "crypto-risk",
  "crypto-flow",
  "crypto-full",
  "crypto-holders",
  "crypto-cex-flows",
  "crypto-social",
  "crypto-bridge",
]);

/**
 * Pre-suite crypto modules regrouped under Crypto Intel when enabled.
 * When the suite is off they return to Financial & Assets / AI Intelligence.
 */
export const CRYPTO_INTEL_LEGACY_SLUGS = new Set([
  "crypto-wallet",
  "crypto-ai",
]);

export function isCryptoIntelSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;

  return CRYPTO_INTEL_MODULE_SLUGS.has(slug.toLowerCase());
}

export function isCryptoIntelLegacySlug(
  slug: string | null | undefined,
): boolean {
  if (!slug) return false;

  return CRYPTO_INTEL_LEGACY_SLUGS.has(slug.toLowerCase());
}

export function isCryptoIntelUnifiedSlug(
  slug: string | null | undefined,
): boolean {
  if (!slug) return false;

  return slug.toLowerCase() === CRYPTO_INTEL_UNIFIED_SLUG;
}
