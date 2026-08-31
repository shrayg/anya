import type { BreachVipField } from "@/lib/breachvip";
import type { GodsEyeSearchType } from "@/lib/godseye";

export type PlatformSearchConfig = {
  godseyeType: GodsEyeSearchType;
  /** OsintCat endpoint — only set for endpoints that exist on OsintCat. */
  osintCatEndpoint?: string;
  /** Additive BreachVIP field when this module maps cleanly to BreachVIP. */
  breachVipField?: BreachVipField;
  /** BreachHub specialty fan-out scope (steam, xbox, roblox, …). */
  breachHubScope?: string;
};

/** Module slugs routed through breach search with platform-specific scopes. */
export const PLATFORM_SEARCH_BY_SLUG: Record<string, PlatformSearchConfig> = {
  email: {
    osintCatEndpoint: "breach",
    godseyeType: "email",
    breachVipField: "email",
  },
  username: {
    osintCatEndpoint: "breach",
    godseyeType: "username",
    breachVipField: "username",
  },
  phone: {
    godseyeType: "phone",
    breachVipField: "phone",
    breachHubScope: "phone",
  },
  minecraft: {
    godseyeType: "minecraft",
    breachVipField: "uuid",
    breachHubScope: "minecraft",
  },
  steam: {
    godseyeType: "steam",
    breachVipField: "steamid",
    breachHubScope: "steam",
  },
  xbox: { godseyeType: "username", breachHubScope: "xbox" },
  telegram: { godseyeType: "telegram", breachHubScope: "telegram" },
  instagram: { godseyeType: "instagram", breachHubScope: "instagram" },
  snapchat: { godseyeType: "snapchat", breachHubScope: "snapchat" },
  tiktok: { godseyeType: "tiktok", breachHubScope: "tiktok" },
  twitter: { godseyeType: "twitter", breachHubScope: "twitter" },
  github: { godseyeType: "github", breachHubScope: "github" },
  hwid: { godseyeType: "username", breachHubScope: "hwid" },
  "facebook-id": { godseyeType: "username", breachHubScope: "facebook" },
  passport: { godseyeType: "username", breachHubScope: "passport" },
  "hash-lookup": { godseyeType: "hash" },
  "password-search": { godseyeType: "password", breachVipField: "password" },
  "name-search": { godseyeType: "name", breachVipField: "name" },
  // Dating modules stay GodsEye/CSINT unless a BreachHub specialty exists.
  tinder: { godseyeType: "username" },
  bumble: { godseyeType: "username" },
  hinge: { godseyeType: "username" },
  match: { godseyeType: "username" },
  okcupid: { godseyeType: "username" },
  pof: { godseyeType: "username" },
  grindr: { godseyeType: "username" },
  badoo: { godseyeType: "username" },
};

export function getPlatformSearchConfig(
  scope: string | null | undefined,
): PlatformSearchConfig | null {
  if (!scope) return null;

  return PLATFORM_SEARCH_BY_SLUG[scope] ?? null;
}

export function isPlatformSearchSlug(scope: string | null | undefined) {
  return Boolean(scope && scope in PLATFORM_SEARCH_BY_SLUG);
}

export function isGodsEyeOnlyPlatformConfig(config: PlatformSearchConfig) {
  return !config.osintCatEndpoint;
}
