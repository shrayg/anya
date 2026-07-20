import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const CORDCAT_API_BASE = "https://api.cord.cat";

export type CordCatUserInfo = {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
  banner?: string | null;
  public_flags?: number;
  accent_color?: number | null;
  banner_color?: string | null;
  /** Discord Nitro profile theme: `[primary, secondary]` as packed RGB ints. */
  theme_colors?: [number, number] | number[] | null;
  bio?: string | null;
  premium_type?: number | null;
  nitro?: boolean | null;
  clan?: {
    tag?: string | null;
    identity_guild_id?: string | null;
    badge?: string | null;
  } | null;
  primary_guild?: {
    tag?: string | null;
    identity_guild_id?: string | null;
    badge?: string | null;
    identity_enabled?: boolean | null;
  } | null;
  clan_tag?: string | null;
  avatar_decoration?: string | null;
  avatar_decoration_data?: {
    asset?: string | null;
  } | null;
  [key: string]: unknown;
};

export type CordCatQueryResponse = {
  userInfo?: CordCatUserInfo | null;
  breach?: {
    success?: boolean;
    resultsCount?: number;
    data?: unknown;
  };
  fivem?: {
    success?: boolean;
    data?: {
      total?: number;
      results?: unknown[];
    };
  };
  statements?: unknown[];
  score?: unknown;
  meta?: unknown;
};

export function getCordCatApiKey(): string | undefined {
  return process.env.CORDCAT_API_KEY?.trim() || undefined;
}

export function isCordCatConfigured(): boolean {
  return Boolean(getCordCatApiKey());
}

export function cordCatProfileUrl(discordId: string): string {
  return `https://cord.cat/${encodeURIComponent(discordId)}`;
}

export async function probeCordCat(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${CORDCAT_API_BASE}/api/status`, {
      cache: "no-store",
      timeoutMs: 8_000,
    });

    if (!res.ok) return false;

    const payload = (await res.json()) as {
      ok?: boolean;
      services?: { discord?: { ok?: boolean } };
    };

    return payload.ok === true || payload.services?.discord?.ok === true;
  } catch {
    return false;
  }
}

async function cordCatGet<T>(
  path: string,
  timeoutMs = 12_000,
): Promise<T | null> {
  const apiKey = getCordCatApiKey();

  if (!apiKey) return null;

  const res = await fetchWithTimeout(`${CORDCAT_API_BASE}${path}`, {
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
    timeoutMs,
  });

  if (res.status === 401 || res.status === 403) {
    return null;
  }

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as T;
}

/** Full CordCat OSINT query (profile + breach + FiveM). Requires API key. */
export async function fetchCordCatQuery(
  discordId: string,
): Promise<CordCatQueryResponse | null> {
  try {
    return await cordCatGet<CordCatQueryResponse>(
      `/api/v2/query/${encodeURIComponent(discordId)}`,
      15_000,
    );
  } catch {
    return null;
  }
}

/** Lighter CordCat tools endpoint — avatar/banner hashes only. */
export async function fetchCordCatToolsUser(
  discordId: string,
): Promise<CordCatUserInfo | null> {
  try {
    return await cordCatGet<CordCatUserInfo>(
      `/api/tools/user/${encodeURIComponent(discordId)}`,
      10_000,
    );
  } catch {
    return null;
  }
}

export async function fetchCordCatUserInfo(
  discordId: string,
): Promise<CordCatUserInfo | null> {
  const query = await fetchCordCatQuery(discordId);

  if (query?.userInfo && typeof query.userInfo === "object") {
    return query.userInfo;
  }

  return fetchCordCatToolsUser(discordId);
}
