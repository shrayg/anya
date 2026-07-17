import {
  cordCatProfileUrl,
  fetchCordCatUserInfo,
  type CordCatUserInfo,
} from "@/lib/cordcat";
import { badgesFromPublicFlags } from "@/lib/discord-badges";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type DiscordProfile = {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string | null;
  accentColor: string | null;
  /** Exact UTC creation timestamp derived from the Discord snowflake. */
  createdAt: string;
  badges: string[];
  discriminator: string;
  bio: string | null;
  nitro: boolean;
  clanTag: string | null;
  avatarDecorationUrl: string | null;
  /** Discreet external profile preview (cord.cat viewer). */
  profilePreviewUrl: string;
};

export type DiscordSearchResult = {
  id: string;
  profile: DiscordProfile;
  leaks: {
    count: number;
    results: unknown[];
  };
  fivem?: {
    accounts: Record<string, unknown> | null;
    bans: Record<string, unknown> | null;
  };
};

const DISCORD_EPOCH = 1_420_070_400_000n;

export function snowflakeCreatedAt(id: string): string {
  try {
    const timestamp = (BigInt(id) >> 22n) + DISCORD_EPOCH;

    return new Date(Number(timestamp)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function defaultAvatarUrl(id: string): string {
  try {
    const index = Number((BigInt(id) >> 22n) % 6n);

    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

function formatAccentColor(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("#")) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  return null;
}

function isAnimatedHash(hash: unknown): hash is string {
  return typeof hash === "string" && hash.startsWith("a_");
}

function buildAvatarUrl(id: string, avatar: unknown): string {
  if (typeof avatar !== "string" || avatar.length === 0) {
    return defaultAvatarUrl(id);
  }

  const extension = isAnimatedHash(avatar) ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${extension}?size=256`;
}

function buildBannerUrl(id: string, banner: unknown): string | null {
  if (typeof banner !== "string" || banner.length === 0) {
    return null;
  }

  const extension = isAnimatedHash(banner) ? "gif" : "png";

  return `https://cdn.discordapp.com/banners/${id}/${banner}.${extension}?size=512`;
}

function buildAvatarDecorationUrl(asset: unknown): string | null {
  if (typeof asset !== "string" || asset.length === 0) return null;

  return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=256&passthrough=true`;
}

function preferCdnUrl(
  provided: unknown,
  built: string | null,
  preferAnimated: boolean,
): string | null {
  if (typeof provided === "string" && provided.length > 0) {
    if (preferAnimated && built && built.includes(".gif")) {
      return built;
    }
    return provided;
  }

  return built;
}

function extractClanTag(data: Record<string, unknown>): string | null {
  const direct =
    (typeof data.clan_tag === "string" && data.clan_tag.trim()) ||
    (typeof data.clanTag === "string" && data.clanTag.trim()) ||
    null;

  if (direct) return direct.replace(/^\[|\]$/g, "");

  const clan = data.clan;
  if (clan && typeof clan === "object") {
    const tag = (clan as { tag?: unknown }).tag;
    if (typeof tag === "string" && tag.trim()) {
      return tag.trim().replace(/^\[|\]$/g, "");
    }
  }

  const primaryGuild = data.primary_guild ?? data.primaryGuild;
  if (primaryGuild && typeof primaryGuild === "object") {
    const tag = (primaryGuild as { tag?: unknown }).tag;
    if (typeof tag === "string" && tag.trim()) {
      return tag.trim().replace(/^\[|\]$/g, "");
    }
  }

  return null;
}

function detectNitro(
  data: Record<string, unknown>,
  avatarHash: unknown,
  bannerHash: unknown,
  badges: string[],
): boolean {
  if (data.nitro === true || data.has_nitro === true || data.premium === true) {
    return true;
  }

  const premiumType = data.premium_type ?? data.premiumType;
  if (typeof premiumType === "number" && premiumType > 0) {
    return true;
  }

  if (
    badges.some((badge) => {
      const key = badge.toUpperCase();
      return key === "NITRO" || key === "PREMIUM";
    })
  ) {
    return true;
  }

  // Custom banners require Nitro; animated avatars are a strong signal.
  if (typeof bannerHash === "string" && bannerHash.length > 0) return true;
  if (isAnimatedHash(avatarHash)) return true;

  return false;
}

function collectBadges(data: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(data.public_flags_array)
    ? data.public_flags_array.map(String)
    : Array.isArray(data.badges)
      ? data.badges.map(String)
      : [];

  const fromFlags = badgesFromPublicFlags(
    data.public_flags ?? data.publicFlags ?? data.flags,
  );

  const merged = [...fromArray, ...fromFlags];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const badge of merged) {
    const key = badge.trim();
    if (!key) continue;
    const norm = key.toUpperCase().replace(/\s+/g, "_");
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }

  return out;
}

function parseProfileFromRaw(
  id: string,
  data: Record<string, unknown>,
): DiscordProfile {
  const username = String(data.username ?? "unknown");
  const globalName =
    typeof data.global_name === "string" && data.global_name.length > 0
      ? data.global_name
      : typeof data.globalName === "string" && data.globalName.length > 0
        ? data.globalName
        : null;
  const displayName = globalName ?? username;

  const avatarHash = data.avatar;
  const bannerHash = data.banner;

  const avatarUrl =
    preferCdnUrl(
      data.avatarURL ?? data.avatar_url ?? data.avatarUrl,
      buildAvatarUrl(id, avatarHash),
      true,
    ) ?? defaultAvatarUrl(id);

  const bannerUrl = preferCdnUrl(
    data.bannerURL ?? data.banner_url ?? data.bannerUrl,
    buildBannerUrl(id, bannerHash),
    true,
  );

  const decorationAsset =
    (data.avatar_decoration_data as { asset?: unknown } | null | undefined)
      ?.asset ??
    data.avatar_decoration ??
    data.avatarDecoration;

  const badges = collectBadges(data);
  const nitro = detectNitro(data, avatarHash, bannerHash, badges);
  if (nitro && !badges.some((b) => b === "NITRO" || b === "PREMIUM")) {
    badges.push("NITRO");
  }

  const bio =
    typeof data.bio === "string" && data.bio.trim().length > 0
      ? data.bio.trim()
      : null;

  return {
    id,
    username,
    globalName,
    displayName,
    avatarUrl,
    bannerUrl,
    accentColor: formatAccentColor(
      data.banner_color ?? data.accent_color ?? data.accentColor,
    ),
    // Always derive from snowflake for exact millisecond precision.
    createdAt: snowflakeCreatedAt(id),
    badges,
    discriminator: String(data.discriminator ?? "0"),
    bio,
    nitro,
    clanTag: extractClanTag(data),
    avatarDecorationUrl: buildAvatarDecorationUrl(decorationAsset),
    profilePreviewUrl: cordCatProfileUrl(id),
  };
}

function fallbackProfile(id: string): DiscordProfile {
  return {
    id,
    username: "Unknown",
    globalName: null,
    displayName: "Unknown user",
    avatarUrl: defaultAvatarUrl(id),
    bannerUrl: null,
    accentColor: null,
    createdAt: snowflakeCreatedAt(id),
    badges: [],
    discriminator: "0",
    bio: null,
    nitro: false,
    clanTag: null,
    avatarDecorationUrl: null,
    profilePreviewUrl: cordCatProfileUrl(id),
  };
}

function isUsableProfile(profile: DiscordProfile): boolean {
  return (
    profile.username !== "Unknown" &&
    profile.username !== "unknown" &&
    profile.displayName !== "Unknown user"
  );
}

async function fetchJapiProfile(userId: string): Promise<DiscordProfile | null> {
  try {
    const res = await fetchWithTimeout(
      `https://japi.rest/discord/v1/user/${encodeURIComponent(userId)}`,
      { cache: "no-store", timeoutMs: 15_000 },
    );

    const payload = (await res.json()) as {
      data?: Record<string, unknown>;
      message?: string;
    };

    if (!res.ok || !payload.data) {
      return null;
    }

    if (
      typeof payload.data.message === "string" &&
      /unknown user/i.test(payload.data.message)
    ) {
      return null;
    }

    if (!payload.data.username && !payload.data.id) {
      return null;
    }

    return parseProfileFromRaw(userId, payload.data);
  } catch {
    return null;
  }
}

async function fetchCordCatProfile(
  userId: string,
): Promise<DiscordProfile | null> {
  const userInfo = await fetchCordCatUserInfo(userId);
  if (!userInfo) return null;

  return parseProfileFromRaw(userId, userInfo as CordCatUserInfo & Record<string, unknown>);
}

export async function fetchDiscordProfile(userId: string): Promise<DiscordProfile> {
  // Prefer CordCat when configured — richer Discord-native profile media.
  const cordProfile = await fetchCordCatProfile(userId);
  if (cordProfile && isUsableProfile(cordProfile)) {
    return cordProfile;
  }

  const japiProfile = await fetchJapiProfile(userId);
  if (japiProfile && isUsableProfile(japiProfile)) {
    // Merge any CordCat media extras onto japi when CordCat only returned partial data.
    if (cordProfile) {
      return {
        ...japiProfile,
        avatarUrl:
          cordProfile.avatarUrl.includes("/avatars/") ||
          cordProfile.avatarUrl.includes(".gif")
            ? cordProfile.avatarUrl
            : japiProfile.avatarUrl,
        bannerUrl: cordProfile.bannerUrl ?? japiProfile.bannerUrl,
        nitro: cordProfile.nitro || japiProfile.nitro,
        clanTag: cordProfile.clanTag ?? japiProfile.clanTag,
        avatarDecorationUrl:
          cordProfile.avatarDecorationUrl ?? japiProfile.avatarDecorationUrl,
        badges:
          cordProfile.badges.length > 0 ? cordProfile.badges : japiProfile.badges,
        createdAt: snowflakeCreatedAt(userId),
        profilePreviewUrl: cordCatProfileUrl(userId),
      };
    }

    return japiProfile;
  }

  return cordProfile ?? fallbackProfile(userId);
}

/** Full precise timestamp (UTC) for account creation from the snowflake. */
export function formatDiscordCreatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDiscordCreatedAtExact(iso: string): string {
  try {
    const date = new Date(iso);
    const formatted = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date);

    return `${formatted} UTC`;
  } catch {
    return iso;
  }
}

export function formatDiscordMemberSince(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function profileAccent(profile: DiscordProfile): string {
  return profile.accentColor ?? "#5865f2";
}
