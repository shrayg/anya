import { randomUUID } from "node:crypto";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  fetchGodsEyeSearchSafe,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";
import type { SanitizedBreachResponse } from "@/lib/osintcat";

const INSTAGRAM_WEB_APP_ID = "936619743392459";
const INSTAGRAM_MOBILE_APP_ID = "567067343352427";
const MOBILE_USER_AGENT =
  "Instagram 269.0.0.18.75 Android (26/8.0.0; 480dpi; 1080x1920; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 314665256)";

const FOLLOWERS_QUERY_HASH = "37479f2b8209594dde7facb0d904896a";
const FOLLOWING_QUERY_HASH = "58712303d941c6855d4e888c5f0cd22f";

const FOLLOWERS_DOC_ID = "28479704797510738576165798526";
const FOLLOWING_DOC_ID = "161046392817718486717479294775";

const DEFAULT_MAX_USERS = 200;
const ABSOLUTE_MAX_USERS = 1_000;
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 20_000;

export type InstagramUserSummary = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  isVerified: boolean;
  isPrivate?: boolean;
};

export type InstagramProfile = {
  id: string;
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl?: string;
  externalUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  isVerified: boolean;
  category?: string;
  businessEmail?: string;
  businessPhone?: string;
};

export type InstagramSearchResult = {
  query: string;
  profile: InstagramProfile | null;
  followers: InstagramUserSummary[];
  following: InstagramUserSummary[];
  leaks: SanitizedBreachResponse;
  warnings: string[];
  truncated: {
    followers: boolean;
    following: boolean;
  };
  totals: {
    followers: number;
    following: number;
  };
  authMode: "session" | "public" | "none";
};

type FriendshipKind = "followers" | "following";

type ListFetchResult = {
  users: InstagramUserSummary[];
  truncated: boolean;
};

export function getInstagramSessionId(): string | undefined {
  const value = process.env.INSTAGRAM_SESSION_ID?.trim();
  return value || undefined;
}

export function getInstagramCsrfToken(): string | undefined {
  const value = process.env.INSTAGRAM_CSRF_TOKEN?.trim();
  return value || undefined;
}

export function normalizeInstagramUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i,
  );
  if (urlMatch?.[1]) {
    const segment = urlMatch[1].toLowerCase();
    if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(segment)) {
      return null;
    }
    return urlMatch[1];
  }

  const normalized = trimmed.replace(/^@/, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function webHeaders(username?: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-ig-app-id": INSTAGRAM_WEB_APP_ID,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Referer: username
      ? `https://www.instagram.com/${username}/`
      : "https://www.instagram.com/",
  };
}

function sessionHeaders(
  sessionId: string,
  csrfToken: string,
): Record<string, string> {
  return {
    "User-Agent": MOBILE_USER_AGENT,
    "x-ig-app-id": INSTAGRAM_MOBILE_APP_ID,
    "x-csrftoken": csrfToken,
    "x-ig-www-claim": "0",
    Accept: "*/*",
    "Accept-Language": "en-US",
    Cookie: `sessionid=${sessionId}; csrftoken=${csrfToken};`,
  };
}

function mapUserSummary(raw: Record<string, unknown>): InstagramUserSummary | null {
  const id = String(raw.pk ?? raw.id ?? "").trim();
  const username = String(raw.username ?? "").trim();
  if (!id || !username) return null;

  return {
    id,
    username,
    fullName: String(raw.full_name ?? "").trim(),
    profilePicUrl:
      typeof raw.profile_pic_url === "string" ? raw.profile_pic_url : undefined,
    isVerified: Boolean(raw.is_verified),
    isPrivate:
      typeof raw.is_private === "boolean" ? raw.is_private : undefined,
  };
}

function mapProfile(raw: Record<string, unknown>): InstagramProfile {
  return {
    id: String(raw.id ?? ""),
    username: String(raw.username ?? ""),
    fullName: String(raw.full_name ?? ""),
    biography: String(raw.biography ?? ""),
    profilePicUrl:
      typeof raw.profile_pic_url_hd === "string"
        ? raw.profile_pic_url_hd
        : typeof raw.profile_pic_url === "string"
          ? raw.profile_pic_url
          : undefined,
    externalUrl:
      typeof raw.external_url === "string" ? raw.external_url : undefined,
    followersCount: Number(
      (raw.edge_followed_by as { count?: number } | undefined)?.count ?? 0,
    ),
    followingCount: Number(
      (raw.edge_follow as { count?: number } | undefined)?.count ?? 0,
    ),
    postsCount: Number(
      (raw.edge_owner_to_timeline_media as { count?: number } | undefined)
        ?.count ?? 0,
    ),
    isPrivate: Boolean(raw.is_private),
    isVerified: Boolean(raw.is_verified),
    category:
      typeof raw.category_name === "string" ? raw.category_name : undefined,
    businessEmail:
      typeof raw.business_email === "string" ? raw.business_email : undefined,
    businessPhone:
      typeof raw.business_phone_number === "string"
        ? raw.business_phone_number
        : undefined,
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.status === 429
        ? "Instagram rate-limited this request. Try again shortly or configure INSTAGRAM_SESSION_ID."
        : `Instagram returned an empty response (${response.status}).`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Instagram returned an unexpected response format.");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchInstagramProfile(
  username: string,
): Promise<InstagramProfile> {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = await fetchWithTimeout(url, {
    headers: webHeaders(username),
    cache: "no-store",
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  const payload = (await parseJsonResponse(response)) as {
    data?: { user?: Record<string, unknown> };
    message?: string;
    status?: string;
  };

  if (!response.ok) {
    const message = payload.message ?? `Instagram profile lookup failed (${response.status}).`;
    throw new Error(message);
  }

  const user = payload.data?.user;
  if (!user?.id) {
    throw new Error(`Instagram user "${username}" was not found.`);
  }

  return mapProfile(user);
}

async function fetchPublicGraphqlList(
  userId: string,
  kind: FriendshipKind,
  maxUsers: number,
): Promise<ListFetchResult> {
  const queryHash =
    kind === "followers" ? FOLLOWERS_QUERY_HASH : FOLLOWING_QUERY_HASH;
  const edgeKey = kind === "followers" ? "edge_followed_by" : "edge_follow";

  const users: InstagramUserSummary[] = [];
  let endCursor: string | undefined;
  let truncated = false;

  while (users.length < maxUsers) {
    const variables: Record<string, unknown> = {
      id: userId,
      include_reel: true,
      fetch_mutual: false,
      first: Math.min(PAGE_SIZE, maxUsers - users.length),
    };
    if (endCursor) {
      variables.after = endCursor;
    }

    const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
    const response = await fetchWithTimeout(url, {
      headers: webHeaders(),
      cache: "no-store",
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const payload = (await parseJsonResponse(response)) as {
      data?: {
        user?: Record<
          string,
          {
            edges?: Array<{ node?: Record<string, unknown> }>;
            page_info?: { has_next_page?: boolean; end_cursor?: string };
          }
        >;
      };
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.message ?? `Instagram ${kind} lookup failed.`);
    }

    const connection = payload.data?.user?.[edgeKey];
    const edges = connection?.edges ?? [];

    for (const edge of edges) {
      if (!edge.node) continue;
      const mapped = mapUserSummary(edge.node);
      if (mapped) users.push(mapped);
      if (users.length >= maxUsers) break;
    }

    const pageInfo = connection?.page_info;
    if (!pageInfo?.has_next_page || !pageInfo.end_cursor || users.length >= maxUsers) {
      truncated = Boolean(pageInfo?.has_next_page && users.length >= maxUsers);
      break;
    }

    endCursor = pageInfo.end_cursor;
    await sleep(250);
  }

  return { users, truncated };
}

async function fetchSessionRestList(
  userId: string,
  kind: FriendshipKind,
  sessionId: string,
  csrfToken: string,
  maxUsers: number,
  rankToken: string,
): Promise<ListFetchResult> {
  const users: InstagramUserSummary[] = [];
  let maxId: string | undefined;
  let truncated = false;

  while (users.length < maxUsers) {
    const params = new URLSearchParams({
      count: String(Math.min(PAGE_SIZE, maxUsers - users.length)),
      rank_token: rankToken,
      search_surface: "follow_list_page",
    });
    if (maxId) params.set("max_id", maxId);

    const url = `https://i.instagram.com/api/v1/friendships/${userId}/${kind}/?${params.toString()}`;
    const response = await fetchWithTimeout(url, {
      headers: sessionHeaders(sessionId, csrfToken),
      cache: "no-store",
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const payload = (await parseJsonResponse(response)) as {
      users?: Array<Record<string, unknown>>;
      next_max_id?: string;
      big_list?: boolean;
      message?: string;
      status?: string;
    };

    if (!response.ok || payload.status === "fail") {
      throw new Error(payload.message ?? `Instagram ${kind} lookup failed.`);
    }

    for (const raw of payload.users ?? []) {
      const mapped = mapUserSummary(raw);
      if (mapped) users.push(mapped);
      if (users.length >= maxUsers) break;
    }

    if (!payload.next_max_id || users.length >= maxUsers) {
      truncated = Boolean(payload.next_max_id && users.length >= maxUsers);
      break;
    }

    maxId = payload.next_max_id;
    await sleep(300);
  }

  return { users, truncated };
}

async function fetchSessionGraphqlList(
  userId: string,
  kind: FriendshipKind,
  sessionId: string,
  csrfToken: string,
  maxUsers: number,
  rankToken: string,
): Promise<ListFetchResult> {
  const clientDocId = kind === "followers" ? FOLLOWERS_DOC_ID : FOLLOWING_DOC_ID;
  const rootField =
    kind === "followers"
      ? "xdt_api__v1__friendships__followers"
      : "xdt_api__v1__friendships__following";

  const users: InstagramUserSummary[] = [];
  let maxId: string | undefined;
  let truncated = false;

  while (users.length < maxUsers) {
    const requestData: Record<string, unknown> = {
      rank_token: rankToken,
      enableGroups: true,
      search_surface: "follow_list_page",
    };

    const variables: Record<string, unknown> = {
      user_id: userId,
      skip_suggested_users: true,
      skip_more_groups_available: true,
      skip_friendship_followers_fields: true,
      request_data: requestData,
      skip_page_size: true,
      skip_pending_admins: true,
      skip_has_more: true,
      search_surface: "follow_list_page",
      query: "",
      skip_big_list: true,
      include_unseen_count: true,
    };

    if (maxId) {
      variables.max_id = maxId;
    }

    const body = new URLSearchParams({
      variables: JSON.stringify(variables),
      doc_id: clientDocId,
    });

    const response = await fetchWithTimeout(
      "https://i.instagram.com/graphql/query",
      {
        method: "POST",
        headers: {
          ...sessionHeaders(sessionId, csrfToken),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
        timeoutMs: REQUEST_TIMEOUT_MS,
      },
    );

    const payload = (await parseJsonResponse(response)) as {
      data?: Record<string, Record<string, unknown>>;
      message?: string;
      status?: string;
    };

    if (!response.ok || payload.status === "fail") {
      throw new Error(payload.message ?? `Instagram ${kind} lookup failed.`);
    }

    const connection = payload.data?.[rootField];
    const chunk = (connection?.users as Array<Record<string, unknown>>) ?? [];

    for (const raw of chunk) {
      const mapped = mapUserSummary(raw);
      if (mapped) users.push(mapped);
      if (users.length >= maxUsers) break;
    }

    const nextMaxId =
      typeof connection?.next_max_id === "string"
        ? connection.next_max_id
        : typeof connection?.next_max_id === "number"
          ? String(connection.next_max_id)
          : undefined;

    if (!nextMaxId || users.length >= maxUsers) {
      truncated = Boolean(nextMaxId && users.length >= maxUsers);
      break;
    }

    maxId = nextMaxId;
    await sleep(300);
  }

  return { users, truncated };
}

async function fetchFriendshipList(
  userId: string,
  kind: FriendshipKind,
  maxUsers: number,
  profileIsPrivate: boolean,
): Promise<{ result: ListFetchResult; authMode: InstagramSearchResult["authMode"] }> {
  const sessionId = getInstagramSessionId();
  const csrfToken = getInstagramCsrfToken() ?? randomUUID().replace(/-/g, "");
  const rankToken = `${userId}_${randomUUID()}`;

  if (sessionId) {
    try {
      const result = await fetchSessionRestList(
        userId,
        kind,
        sessionId,
        csrfToken,
        maxUsers,
        rankToken,
      );
      return { result, authMode: "session" };
    } catch (restError) {
      try {
        const result = await fetchSessionGraphqlList(
          userId,
          kind,
          sessionId,
          csrfToken,
          maxUsers,
          rankToken,
        );
        return { result, authMode: "session" };
      } catch {
        throw restError instanceof Error
          ? restError
          : new Error("Instagram session lookup failed.");
      }
    }
  }

  if (profileIsPrivate) {
    return {
      result: { users: [], truncated: false },
      authMode: "none",
    };
  }

  try {
    const result = await fetchPublicGraphqlList(userId, kind, maxUsers);
    return { result, authMode: "public" };
  } catch {
    return {
      result: { users: [], truncated: false },
      authMode: "none",
    };
  }
}

export async function probeInstagramAvailability(): Promise<boolean> {
  if (getInstagramSessionId()) return true;

  try {
    const response = await fetchWithTimeout(
      "https://i.instagram.com/api/v1/users/web_profile_info/?username=natgeo",
      {
        headers: webHeaders("natgeo"),
        cache: "no-store",
        timeoutMs: 8_000,
      },
    );

    if (response.status === 429) return true;
    return response.ok;
  } catch {
    return Boolean(getInstagramSessionId());
  }
}

export async function searchInstagram(
  rawQuery: string,
  options?: { maxUsers?: number; lists?: "both" | "followers" | "following" },
): Promise<InstagramSearchResult> {
  const username = normalizeInstagramUsername(rawQuery);
  if (!username) {
    throw new Error("Enter a valid Instagram username or profile URL.");
  }

  const maxUsers = Math.min(
    Math.max(options?.maxUsers ?? DEFAULT_MAX_USERS, 1),
    ABSOLUTE_MAX_USERS,
  );
  const lists = options?.lists ?? "both";
  const warnings: string[] = [];

  const [profile, leaksRaw] = await Promise.all([
    fetchInstagramProfile(username),
    fetchGodsEyeSearchSafe("instagram", username)
      .then((data) => sanitizeGodsEyeSearch(data))
      .catch(() => ({ count: 0, results: [] as unknown[] })),
  ]);

  if (profile.isPrivate && !getInstagramSessionId()) {
    warnings.push(
      "This account is private. Follower and following lists require INSTAGRAM_SESSION_ID with access to that profile.",
    );
  }

  let followers: InstagramUserSummary[] = [];
  let following: InstagramUserSummary[] = [];
  let followersTruncated = false;
  let followingTruncated = false;
  let authMode: InstagramSearchResult["authMode"] = "none";

  if (lists === "both" || lists === "followers") {
    const { result, authMode: mode } = await fetchFriendshipList(
      profile.id,
      "followers",
      maxUsers,
      profile.isPrivate,
    );
    followers = result.users;
    followersTruncated = result.truncated;
    authMode = mode;
  }

  if (lists === "both" || lists === "following") {
    const { result, authMode: mode } = await fetchFriendshipList(
      profile.id,
      "following",
      maxUsers,
      profile.isPrivate,
    );
    following = result.users;
    followingTruncated = result.truncated;
    if (authMode === "none" && mode !== "none") {
      authMode = mode;
    }
  }

  if (!getInstagramSessionId() && authMode === "none" && !profile.isPrivate) {
    warnings.push(
      "Instagram blocked unauthenticated list access from this server. Set INSTAGRAM_SESSION_ID in the server environment to unlock full follower and following export.",
    );
  }

  if (followersTruncated || followingTruncated) {
    warnings.push(
      `Lists were capped at ${maxUsers} accounts per request. Export JSON for the partial list returned.`,
    );
  }

  return {
    query: username,
    profile,
    followers,
    following,
    leaks: leaksRaw,
    warnings,
    truncated: {
      followers: followersTruncated,
      following: followingTruncated,
    },
    totals: {
      followers: profile.followersCount,
      following: profile.followingCount,
    },
    authMode,
  };
}
