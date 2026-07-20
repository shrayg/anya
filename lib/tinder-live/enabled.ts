/**
 * Tinder Live (recs + discovery filters) kill-switch.
 *
 * Requires server credentials:
 *   TINDER_X_AUTH_TOKEN
 *   TINDER_DEVICE_ID
 *
 * Explicit disable: TINDER_LIVE_ENABLED=0
 * Explicit enable without auto: TINDER_LIVE_ENABLED=1 (still needs credentials)
 *
 * This is NOT username/breach OSINT — it uses a logged-in Tinder operator
 * session to pull recommendation cards after applying discovery filters.
 * Do not expose like / dislike / chat / boost to end users.
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

export function hasTinderLiveCredentials(): boolean {
  return Boolean(
    process.env.TINDER_X_AUTH_TOKEN?.trim() &&
      process.env.TINDER_DEVICE_ID?.trim(),
  );
}

/** Live Tinder recs module is available when credentials exist and not opted out. */
export function isTinderLiveEnabled(): boolean {
  if (envFlagOff(process.env.TINDER_LIVE_ENABLED)) return false;
  if (envFlagOff(process.env.NEXT_PUBLIC_TINDER_LIVE)) return false;

  return hasTinderLiveCredentials();
}

export const TINDER_LIVE_MODULE_SLUG = "tinder-live";

export function isTinderLiveSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").toLowerCase() === TINDER_LIVE_MODULE_SLUG;
}
