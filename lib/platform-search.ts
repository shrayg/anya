import type { GodsEyeSearchType } from "@/lib/godseye";

export type PlatformSearchConfig = {
  godseyeType: GodsEyeSearchType;
  /** OsintCat endpoint — only set for endpoints that exist on OsintCat. */
  osintCatEndpoint?: string;
};

/** Module slugs routed through breach search with platform-specific scopes. */
export const PLATFORM_SEARCH_BY_SLUG: Record<string, PlatformSearchConfig> = {
  username: { osintCatEndpoint: "breach", godseyeType: "username" },
  phone: { godseyeType: "phone" },
  minecraft: { godseyeType: "minecraft" },
  steam: { godseyeType: "steam" },
  telegram: { godseyeType: "telegram" },
  instagram: { godseyeType: "instagram" },
  snapchat: { godseyeType: "snapchat" },
  tiktok: { godseyeType: "tiktok" },
  twitter: { godseyeType: "twitter" },
  github: { godseyeType: "github" },
  "hash-lookup": { godseyeType: "hash" },
  "password-search": { godseyeType: "password" },
  "name-search": { godseyeType: "name" },
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
