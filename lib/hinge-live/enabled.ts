/**
 * Hinge Live (recs + hydrate + local filter) kill-switch.
 *
 * Requires server credentials from a company-operated Hinge session:
 *   HINGE_AUTHORIZATION (or HINGE_BEARER_TOKEN)
 *   HINGE_DEVICE_ID
 *   HINGE_INSTALL_ID
 *
 * Optional: HINGE_PLAYER_ID, HINGE_SESSION_ID, app version headers.
 *
 * Traffic goes through OSINT_RESIDENTIAL_PROXY_URL / INSTAGRAM_PROXY_URL by
 * default (HINGE_LIVE_REQUIRE_PROXY=0 to allow direct egress).
 *
 * Explicit disable: HINGE_LIVE_ENABLED=0
 *
 * This is NOT username/breach OSINT — it uses a logged-in Hinge session to
 * pull recommendation subject IDs, hydrate public profiles/content, and
 * optionally filter locally. Do not expose like / rate / chat to end users.
 */

import { isResidentialProxyConfigured } from "@/lib/residential-proxy";

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

export function getHingeAuthorization(): string {
  const raw =
    process.env.HINGE_AUTHORIZATION?.trim() ||
    process.env.HINGE_BEARER_TOKEN?.trim() ||
    "";

  if (!raw) return "";
  if (/^bearer\s+/i.test(raw)) return raw;

  return `Bearer ${raw}`;
}

export function hasHingeLiveCredentials(): boolean {
  return Boolean(
    getHingeAuthorization() &&
      process.env.HINGE_DEVICE_ID?.trim() &&
      process.env.HINGE_INSTALL_ID?.trim(),
  );
}

function hingeRequiresResidentialProxy(): boolean {
  const raw = process.env.HINGE_LIVE_REQUIRE_PROXY?.trim().toLowerCase();

  if (raw == null || raw === "") return true;

  return !envFlagOff(raw);
}

/** Live Hinge recs module is available when credentials (+ proxy if required) exist. */
export function isHingeLiveEnabled(): boolean {
  if (envFlagOff(process.env.HINGE_LIVE_ENABLED)) return false;
  if (envFlagOff(process.env.NEXT_PUBLIC_HINGE_LIVE)) return false;
  if (!hasHingeLiveCredentials()) return false;
  if (hingeRequiresResidentialProxy() && !isResidentialProxyConfigured()) {
    return false;
  }

  return true;
}

export const HINGE_LIVE_MODULE_SLUG = "hinge-live";

export function isHingeLiveSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").toLowerCase() === HINGE_LIVE_MODULE_SLUG;
}
