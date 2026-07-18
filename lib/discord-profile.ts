import {
  cordCatProfileUrl,
  fetchCordCatUserInfo,
  type CordCatUserInfo,
} from "@/lib/cordcat";
import { badgesFromPublicFlags } from "@/lib/discord-badges";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type DiscordNameplate = {
  asset: string;
  /** Static PNG for display / download. */
  url: string;
  /** Animated media URL (webm / gif / webp / apng) when available. */
  animatedUrl: string | null;
  label: string | null;
  /** Human-readable description for the nameplate card. */
  description: string | null;
  palette: string | null;
};

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
  /** Clan / primary guild badge icon URL when available. */
  clanBadgeUrl: string | null;
  avatarDecorationUrl: string | null;
  nameplate: DiscordNameplate | null;
  /** Discreet external profile preview (cord.cat viewer). */
  profilePreviewUrl: string;
};

export type DiscordDsaSanction = {
  id: string;
  severity: string;
  status: string;
  description: string;
  date: string;
  details?: Record<string, unknown>;
};

export type DiscordSearchResult = {
  id: string;
  profile: DiscordProfile;
  leaks: {
    count: number;
    results: unknown[];
  };
  fivem?: {
    count: number;
    accounts: unknown[];
    bans: unknown[];
  };
  dsa?: {
    count: number;
    sanctions: DiscordDsaSanction[];
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

/** Pull a Discord avatar/banner hash from a raw hash or CDN URL. */
function extractMediaHash(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const raw = value.trim();
  const bare = raw.replace(/\.(gif|png|webp|jpe?g)(\?.*)?$/i, "");
  if (/^(a_[a-zA-Z0-9]+|[a-f0-9]{16,})$/i.test(bare) && !bare.includes("/")) {
    return bare;
  }

  const fromUrl = raw.match(
    /\/(?:avatars|banners)\/\d+\/(a_[a-zA-Z0-9]+|[a-f0-9]{16,})\./i,
  );
  return fromUrl?.[1] ?? null;
}

/**
 * Discord serves the first frame for a_* hashes when the extension is png/webp.
 * Rewrite those CDN URLs to .gif so the animation actually plays.
 */
function rewriteAnimatedDiscordCdnUrl(url: string): string {
  return url.replace(
    /(\/(?:avatars|banners)\/\d+\/a_[a-zA-Z0-9]+)\.(?:png|webp|jpe?g)(\?|$)/i,
    "$1.gif$2",
  );
}

function isLikelyAnimatedUrl(url: string): boolean {
  if (/\.(gif|webm|mp4)(\?|$)/i.test(url)) return true;
  if (/[?&]passthrough=true\b/i.test(url)) return true;
  if (/\/a_[a-zA-Z0-9]+\.gif/i.test(url)) return true;
  return false;
}

function buildAvatarUrl(id: string, avatar: unknown): string {
  const hash = extractMediaHash(avatar);
  if (!hash) {
    return defaultAvatarUrl(id);
  }

  const extension = isAnimatedHash(hash) ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${id}/${hash}.${extension}?size=256`;
}

function buildBannerUrl(id: string, banner: unknown): string | null {
  const hash = extractMediaHash(banner);
  if (!hash) {
    return null;
  }

  const extension = isAnimatedHash(hash) ? "gif" : "png";

  return `https://cdn.discordapp.com/banners/${id}/${hash}.${extension}?size=512`;
}

function buildAvatarDecorationUrl(asset: unknown): string | null {
  if (typeof asset !== "string" || asset.length === 0) return null;

  if (/^https?:\/\//i.test(asset)) {
    try {
      const parsed = new URL(asset);
      if (
        parsed.hostname.includes("discord") &&
        parsed.pathname.includes("avatar-decoration")
      ) {
        // passthrough=true is required for Discord APNG decorations to animate.
        parsed.searchParams.set("passthrough", "true");
        if (!parsed.searchParams.has("size")) {
          parsed.searchParams.set("size", "256");
        }
      }
      return parsed.toString();
    } catch {
      return asset;
    }
  }

  const hash = asset.replace(/\.(png|webp|gif)$/i, "");
  return `https://cdn.discordapp.com/avatar-decoration-presets/${hash}.png?size=256&passthrough=true`;
}

/**
 * Prefer CordCat / provider media URLs when they already animate;
 * otherwise fall back to a correctly built Discord CDN URL (gif for a_*).
 */
function preferAnimatedMediaUrl(
  provided: unknown,
  built: string | null,
): string | null {
  const providedUrl =
    typeof provided === "string" && provided.length > 0
      ? rewriteAnimatedDiscordCdnUrl(provided)
      : null;

  if (providedUrl && isLikelyAnimatedUrl(providedUrl)) {
    return providedUrl;
  }

  if (built && (built.includes(".gif") || isLikelyAnimatedUrl(built))) {
    return built;
  }

  return providedUrl ?? built;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function extractClanTag(data: Record<string, unknown>): string | null {
  const direct =
    (typeof data.clan_tag === "string" && data.clan_tag.trim()) ||
    (typeof data.clanTag === "string" && data.clanTag.trim()) ||
    null;

  if (direct) return direct.replace(/^\[|\]$/g, "");

  const clan = asRecord(data.clan);
  if (clan) {
    const tag = clan.tag;
    if (typeof tag === "string" && tag.trim()) {
      return tag.trim().replace(/^\[|\]$/g, "");
    }
  }

  const primaryGuild = asRecord(data.primary_guild ?? data.primaryGuild);
  if (primaryGuild) {
    const tag = primaryGuild.tag;
    if (typeof tag === "string" && tag.trim()) {
      return tag.trim().replace(/^\[|\]$/g, "");
    }
  }

  return null;
}

function extractClanBadgeUrl(data: Record<string, unknown>): string | null {
  const clan = asRecord(data.clan);
  const primaryGuild = asRecord(data.primary_guild ?? data.primaryGuild);
  const source = primaryGuild ?? clan;
  if (!source) return null;

  const guildId =
    (typeof source.identity_guild_id === "string" && source.identity_guild_id) ||
    (typeof source.identityGuildId === "string" && source.identityGuildId) ||
    (typeof source.id === "string" && source.id) ||
    null;
  const badge =
    (typeof source.badge === "string" && source.badge) ||
    (typeof source.badge_hash === "string" && source.badge_hash) ||
    null;

  if (!guildId || !badge) return null;

  return `https://cdn.discordapp.com/clan-badges/${guildId}/${badge}.png?size=64`;
}

function humanizeNameplateLabel(raw: string | null, asset: string): string | null {
  if (raw && raw.trim() && !/^COLLECTIBLES_/i.test(raw) && raw.trim().length > 2) {
    return raw.trim();
  }

  const fromAsset = asset
    .replace(/^nameplates\//i, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .pop();

  if (!fromAsset) return null;

  return fromAsset
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function isAnimatedNameplateUrl(url: string): boolean {
  return (
    /\.(webm|mp4|gif|webp)(\?|$)/i.test(url) ||
    /\/asset\.webm(\?|$)/i.test(url) ||
    /animated/i.test(url)
  );
}

function extractNameplate(data: Record<string, unknown>): DiscordNameplate | null {
  const collectibles = asRecord(data.collectibles);
  const nameplate =
    asRecord(collectibles?.nameplate) ??
    asRecord(data.nameplate) ??
    asRecord(data.name_plate);

  if (!nameplate) return null;

  const asset =
    pickFirstString(nameplate.asset, nameplate.asset_path, nameplate.path) ??
    null;

  if (!asset) return null;

  const normalized = asset.endsWith("/") ? asset : `${asset}/`;
  const label = pickFirstString(nameplate.label, nameplate.description);
  const palette = pickFirstString(nameplate.palette);

  const rawUrl = pickFirstString(nameplate.url, nameplate.src, nameplate.href);
  const providedAnimated = pickFirstString(
    nameplate.animated_url,
    nameplate.animatedUrl,
    nameplate.animation_url,
    nameplate.animationUrl,
    nameplate.animation,
    nameplate.video,
    nameplate.video_url,
    nameplate.videoUrl,
    nameplate.media,
    nameplate.media_url,
    nameplate.webm,
    nameplate.gif,
    rawUrl && isAnimatedNameplateUrl(rawUrl) ? rawUrl : null,
  );
  const providedStatic = pickFirstString(
    nameplate.static_url,
    nameplate.staticUrl,
    nameplate.img,
    nameplate.image,
    nameplate.img_url,
    rawUrl && !isAnimatedNameplateUrl(rawUrl) ? rawUrl : null,
  );

  const cdnStatic = `https://cdn.discordapp.com/assets/collectibles/${normalized}static.png`;
  const cdnAnimated = `https://cdn.discordapp.com/assets/collectibles/${normalized}asset.webm`;

  return {
    asset: normalized,
    url: providedStatic ?? cdnStatic,
    // Prefer CordCat animated URL; fall back to Discord CDN webm.
    animatedUrl: providedAnimated ?? cdnAnimated,
    label,
    description: humanizeNameplateLabel(label, normalized),
    palette,
  };
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

  const avatarHash =
    extractMediaHash(data.avatar) ??
    extractMediaHash(data.avatarURL ?? data.avatar_url ?? data.avatarUrl);
  const bannerHash =
    extractMediaHash(data.banner) ??
    extractMediaHash(data.bannerURL ?? data.banner_url ?? data.bannerUrl);

  const avatarUrl =
    preferAnimatedMediaUrl(
      data.avatarURL ?? data.avatar_url ?? data.avatarUrl,
      avatarHash ? buildAvatarUrl(id, avatarHash) : null,
    ) ?? defaultAvatarUrl(id);

  const bannerUrl = preferAnimatedMediaUrl(
    data.bannerURL ?? data.banner_url ?? data.bannerUrl,
    bannerHash ? buildBannerUrl(id, bannerHash) : null,
  );

  const decorationData = asRecord(data.avatar_decoration_data);
  const decorationAsset =
    decorationData?.asset ??
    data.avatar_decoration ??
    data.avatarDecoration;
  const decorationProvidedUrl =
    data.avatar_decoration_url ??
    data.avatarDecorationUrl ??
    data.avatar_decoration_sku_url ??
    (typeof data.avatar_decoration === "string" &&
    /^https?:\/\//i.test(data.avatar_decoration)
      ? data.avatar_decoration
      : null);

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
    clanBadgeUrl: extractClanBadgeUrl(data),
    avatarDecorationUrl:
      buildAvatarDecorationUrl(decorationProvidedUrl) ??
      buildAvatarDecorationUrl(decorationAsset),
    nameplate: extractNameplate(data),
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
    clanBadgeUrl: null,
    avatarDecorationUrl: null,
    nameplate: null,
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
        nameplate: cordProfile.nameplate ?? japiProfile.nameplate,
        clanBadgeUrl: cordProfile.clanBadgeUrl ?? japiProfile.clanBadgeUrl,
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
    const formatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(date);

    return formatted;
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

export function formatDsaDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function profileAccent(profile: DiscordProfile): string {
  return profile.accentColor ?? "#5865f2";
}
