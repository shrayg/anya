import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type DiscordProfile = {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string | null;
  accentColor: string | null;
  createdAt: string;
  badges: string[];
  discriminator: string;
  bio: string | null;
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

function snowflakeCreatedAt(id: string): string {
  try {
    const timestamp = (BigInt(id) >> 22n) + DISCORD_EPOCH;

    return new Date(Number(timestamp)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function defaultAvatarUrl(id: string): string {
  try {
    const index = Number((BigInt(id) >> 22n) % 5n);

    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

function formatAccentColor(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("#")) {
    return value;
  }

  if (typeof value === "number") {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  return null;
}

function buildAvatarUrl(id: string, avatar: unknown): string {
  if (typeof avatar !== "string" || avatar.length === 0) {
    return defaultAvatarUrl(id);
  }

  const extension = avatar.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${extension}?size=256`;
}

function buildBannerUrl(id: string, banner: unknown): string | null {
  if (typeof banner !== "string" || banner.length === 0) {
    return null;
  }

  const extension = banner.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/banners/${id}/${banner}.${extension}?size=512`;
}

function parseJapiProfile(id: string, data: Record<string, unknown>): DiscordProfile {
  const username = String(data.username ?? "unknown");
  const globalName =
    typeof data.global_name === "string" && data.global_name.length > 0
      ? data.global_name
      : null;
  const displayName = globalName ?? username;

  const avatarUrl =
    typeof data.avatarURL === "string" && data.avatarURL.length > 0
      ? data.avatarURL
      : buildAvatarUrl(id, data.avatar);

  const bannerUrl =
    typeof data.bannerURL === "string" && data.bannerURL.length > 0
      ? data.bannerURL
      : buildBannerUrl(id, data.banner);

  const createdAt =
    typeof data.createdAt === "string"
      ? data.createdAt
      : typeof data.createdTimestamp === "number"
        ? new Date(data.createdTimestamp).toISOString()
        : snowflakeCreatedAt(id);

  const badges = Array.isArray(data.public_flags_array)
    ? data.public_flags_array.map(String)
    : [];

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
    accentColor: formatAccentColor(data.banner_color ?? data.accent_color),
    createdAt,
    badges,
    discriminator: String(data.discriminator ?? "0"),
    bio,
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
  };
}

export async function fetchDiscordProfile(userId: string): Promise<DiscordProfile> {
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
      return fallbackProfile(userId);
    }

    return parseJapiProfile(userId, payload.data);
  } catch {
    return fallbackProfile(userId);
  }
}

export function formatDiscordCreatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
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
