import { randomUUID } from "node:crypto";
import "server-only";

import { ProxyAgent } from "undici";

import {
  getActiveInstagramAccount,
  rotateInstagramAccount,
} from "@/lib/instagram-accounts";
import type { SecondDegreeGraph } from "@/lib/instagram-second-degree";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  fetchGodsEyeSearchSafe,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import {
  fetchInstagramActivityGraph,
  type InstagramActivityGraph,
} from "@/lib/instagram-activity";

export { normalizeInstagramUsername } from "@/lib/instagram-username";
import { normalizeInstagramUsername } from "@/lib/instagram-username";

const INSTAGRAM_WEB_APP_ID = "936619743392459";
const FOLLOWERS_QUERY_HASH = "37479f2b8209594dde7facb0d904896a";
const FOLLOWING_QUERY_HASH = "58712303d941c6855d4e888c5f0cd22f";

const DEFAULT_MAX_USERS = 10_000;
const ABSOLUTE_MAX_USERS = 10_000;
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 25_000;
const LIST_PAGE_DELAY_MS = 350;
const MAX_EMPTY_RETRIES = 3;
const BIO_ENRICH_CONCURRENCY = 4;
const DEFAULT_BIO_ENRICH_LIMIT = 40;

export type InstagramUserSummary = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  isVerified: boolean;
  isPrivate?: boolean;
  biography?: string;
  externalUrl?: string;
  category?: string;
  followerCount?: number;
  followingCount?: number;
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
  mutuals: InstagramUserSummary[];
  activity: InstagramActivityGraph | null;
  secondDegree: SecondDegreeGraph | null;
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
  discovery: {
    mutualFirst: boolean;
    followersPagesScanned: number;
    followingPagesScanned: number;
    stoppedAfterFindingMutualCandidates: boolean;
  };
  authMode: "session" | "public" | "none";
};

type FriendshipKind = "followers" | "following";

type ListFetchResult = {
  users: InstagramUserSummary[];
  truncated: boolean;
  pagesScanned?: number;
  stoppedAfterFindingIds?: boolean;
};

export function getInstagramSessionId(): string | undefined {
  const account = getActiveInstagramAccount();
  return account?.sessionId;
}

export function getInstagramCsrfToken(): string | undefined {
  const account = getActiveInstagramAccount();
  return account?.csrfToken;
}

function getInstagramExtraCookies(): string {
  const account = getActiveInstagramAccount();
  const parts: string[] = [];
  if (account?.mid) parts.push(`mid=${account.mid}`);
  if (account?.igDid) parts.push(`ig_did=${account.igDid}`);
  if (account?.datr) parts.push(`datr=${account.datr}`);
  if (account?.dsUserId) parts.push(`ds_user_id=${account.dsUserId}`);
  return parts.join("; ");
}

function buildSessionCookie(sessionId: string, csrfToken: string): string {
  const account = getActiveInstagramAccount();
  const extra = getInstagramExtraCookies();
  const dsUserId = account?.dsUserId || sessionId.split(":")[0] || "";
  return [
    `sessionid=${sessionId}`,
    `csrftoken=${csrfToken}`,
    dsUserId ? `ds_user_id=${dsUserId}` : "",
    extra,
  ]
    .filter(Boolean)
    .join("; ");
}

// ---- Residential proxy support (undici ProxyAgent) ----
const proxyDispatcherCache = new Map<string, ProxyAgent>();

/**
 * Returns an undici dispatcher routing Instagram traffic through a residential
 * proxy when INSTAGRAM_PROXY_URL (or the active account's proxy) is configured.
 * This is the single most effective mitigation for datacenter-IP challenges.
 */
export function getInstagramDispatcher(): ProxyAgent | undefined {
  const account = getActiveInstagramAccount();
  const proxyUrl =
    account?.proxyUrl || process.env.INSTAGRAM_PROXY_URL?.trim() || "";
  if (!proxyUrl) return undefined;
  let dispatcher = proxyDispatcherCache.get(proxyUrl);
  if (!dispatcher) {
    dispatcher = new ProxyAgent(proxyUrl);
    proxyDispatcherCache.set(proxyUrl, dispatcher);
  }
  return dispatcher;
}

/** Detects Instagram anti-automation challenge / login-wall responses. */
export function isInstagramChallengeText(text: string): boolean {
  return /checkpoint_required|challenge_required|require_login|login_required|please wait a few minutes|verify (it'?s|its) you|captcha|automated behaviou?r/i.test(
    text,
  );
}

/**
 * Runs an Instagram operation with bounded retries. On a 429 / challenge, it
 * backs off and (if more than one account is configured) rotates to the next
 * session so the pool spreads Instagram's per-account/IP budget.
 */
export async function withInstagramRateLimitRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const baseDelay = options?.baseDelayMs ?? 1_500;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        /rate.?limit|429|challenge|checkpoint|require_login|please wait|html challenge|network error/i.test(
          message,
        );
      if (!retryable || attempt === retries) break;
      rotateInstagramAccount();
      await sleep(baseDelay * (attempt + 1) + Math.random() * 400);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Instagram request failed after retries.");
}

export function browserHeaders(
  username?: string,
  sessionId?: string,
  csrfToken?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-ig-app-id": INSTAGRAM_WEB_APP_ID,
    "x-requested-with": "XMLHttpRequest",
    "x-asbd-id": "359341",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Origin: "https://www.instagram.com",
    Referer: username
      ? `https://www.instagram.com/${username}/`
      : "https://www.instagram.com/",
  };

  if (sessionId && csrfToken) {
    headers["x-csrftoken"] = csrfToken;
    headers.Cookie = buildSessionCookie(sessionId, csrfToken);
  }

  return headers;
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
    biography:
      typeof raw.biography === "string" ? raw.biography : undefined,
    externalUrl:
      typeof raw.external_url === "string" ? raw.external_url : undefined,
    category:
      typeof raw.category === "string"
        ? raw.category
        : typeof raw.category_name === "string"
          ? raw.category_name
          : undefined,
  };
}

function mapProfileFromInfo(raw: Record<string, unknown>): InstagramProfile {
  return {
    id: String(raw.pk ?? raw.id ?? ""),
    username: String(raw.username ?? ""),
    fullName: String(raw.full_name ?? ""),
    biography: String(raw.biography ?? ""),
    profilePicUrl:
      typeof raw.hd_profile_pic_url_info === "object" &&
      raw.hd_profile_pic_url_info &&
      typeof (raw.hd_profile_pic_url_info as { url?: string }).url === "string"
        ? (raw.hd_profile_pic_url_info as { url: string }).url
        : typeof raw.profile_pic_url === "string"
          ? raw.profile_pic_url
          : undefined,
    externalUrl:
      typeof raw.external_url === "string" ? raw.external_url : undefined,
    followersCount: Number(raw.follower_count ?? 0),
    followingCount: Number(raw.following_count ?? 0),
    postsCount: Number(raw.media_count ?? 0),
    isPrivate: Boolean(raw.is_private),
    isVerified: Boolean(raw.is_verified),
    category:
      typeof raw.category === "string"
        ? raw.category
        : typeof raw.category_name === "string"
          ? raw.category_name
          : undefined,
    businessEmail:
      typeof raw.public_email === "string" ? raw.public_email : undefined,
    businessPhone:
      typeof raw.public_phone_number === "string"
        ? raw.public_phone_number
        : undefined,
  };
}

function mapProfileFromWeb(raw: Record<string, unknown>): InstagramProfile {
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
        ? "Instagram rate-limited this request. Try again shortly."
        : `Instagram returned an empty response (${response.status}).`,
    );
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    // HTML instead of JSON == login wall / captcha / "verify it's you" page.
    throw new Error(
      "Instagram returned an HTML challenge page (human verification). Route traffic through a residential INSTAGRAM_PROXY_URL and/or add more accounts to INSTAGRAM_ACCOUNTS to avoid datacenter-IP checkpoints.",
    );
  }

  try {
    const payload = JSON.parse(text) as unknown;
    if (isInstagramChallengeText(text)) {
      throw new Error(
        "Instagram flagged this session (challenge_required). It needs re-verification or a residential proxy.",
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Instagram")) {
      throw error;
    }
    throw new Error("Instagram returned an unexpected response format.");
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function requireSession(): { sessionId: string; csrfToken: string } {
  const sessionId = getInstagramSessionId();
  if (!sessionId) {
    throw new Error(
      "INSTAGRAM_SESSION_ID is not configured. Add the Instagram session cookie on the server.",
    );
  }

  return {
    sessionId,
    csrfToken: getInstagramCsrfToken() ?? randomUUID().replace(/-/g, ""),
  };
}

async function resolveUserIdByUsername(username: string): Promise<{
  id: string;
  fullName: string;
  profilePicUrl?: string;
  isPrivate: boolean;
  isVerified: boolean;
  socialContext?: string;
}> {
  const { sessionId, csrfToken } = requireSession();
  const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}&include_reel=true`;
  const response = await fetchWithTimeout(url, {
    headers: browserHeaders(username, sessionId, csrfToken),
    cache: "no-store",
    timeoutMs: REQUEST_TIMEOUT_MS,
    dispatcher: getInstagramDispatcher(),
  });

  const payload = (await parseJsonResponse(response)) as {
    users?: Array<{
      user?: {
        pk?: string | number;
        username?: string;
        full_name?: string;
        profile_pic_url?: string;
        is_private?: boolean;
        is_verified?: boolean;
        social_context?: string;
      };
    }>;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Instagram username search failed.");
  }

  const hit = payload.users?.find(
    (entry) =>
      entry.user?.username?.toLowerCase() === username.toLowerCase(),
  )?.user;

  if (!hit?.pk) {
    throw new Error(`Instagram user "${username}" was not found.`);
  }

  return {
    id: String(hit.pk),
    fullName: String(hit.full_name ?? ""),
    profilePicUrl:
      typeof hit.profile_pic_url === "string" ? hit.profile_pic_url : undefined,
    isPrivate: Boolean(hit.is_private),
    isVerified: Boolean(hit.is_verified),
    socialContext:
      typeof hit.social_context === "string" ? hit.social_context : undefined,
  };
}

export async function fetchInstagramUserInfoById(
  userId: string,
  usernameHint?: string,
): Promise<InstagramProfile> {
  const { sessionId, csrfToken } = requireSession();
  const url = `https://www.instagram.com/api/v1/users/${userId}/info/`;
  const response = await fetchWithTimeout(url, {
    headers: browserHeaders(usernameHint, sessionId, csrfToken),
    cache: "no-store",
    timeoutMs: REQUEST_TIMEOUT_MS,
    dispatcher: getInstagramDispatcher(),
  });

  const payload = (await parseJsonResponse(response)) as {
    user?: Record<string, unknown>;
    message?: string;
    status?: string;
  };

  if (!response.ok || payload.status === "fail" || !payload.user) {
    throw new Error(payload.message ?? `Could not load Instagram user ${userId}.`);
  }

  return mapProfileFromInfo(payload.user);
}

async function fetchWebProfileInfo(
  username: string,
): Promise<InstagramProfile | null> {
  const sessionId = getInstagramSessionId();
  const csrfToken = getInstagramCsrfToken() ?? randomUUID().replace(/-/g, "");
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: browserHeaders(username, sessionId, csrfToken),
      cache: "no-store",
      timeoutMs: REQUEST_TIMEOUT_MS,
      dispatcher: getInstagramDispatcher(),
    });

    if (!response.ok) return null;

    const payload = (await parseJsonResponse(response)) as {
      data?: { user?: Record<string, unknown> };
    };
    const user = payload.data?.user;
    if (!user?.id) return null;
    return mapProfileFromWeb(user);
  } catch {
    return null;
  }
}

function parseFollowerCountHint(socialContext?: string): number | undefined {
  if (!socialContext) return undefined;
  const match = socialContext.match(/([\d,.]+)\s*([KkMmBb])?\s*followers?/i);
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "K") return Math.round(base * 1_000);
  if (suffix === "M") return Math.round(base * 1_000_000);
  if (suffix === "B") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

export async function fetchInstagramProfile(
  username: string,
): Promise<InstagramProfile> {
  const webProfile = await fetchWebProfileInfo(username);
  if (webProfile) return webProfile;

  if (!getInstagramSessionId()) {
    throw new Error(
      `Could not load Instagram profile for "${username}". Configure INSTAGRAM_SESSION_ID.`,
    );
  }

  const resolved = await resolveUserIdByUsername(username);
  try {
    return await fetchInstagramUserInfoById(resolved.id, username);
  } catch {
    return {
      id: resolved.id,
      username,
      fullName: resolved.fullName,
      biography: "",
      profilePicUrl: resolved.profilePicUrl,
      followersCount: parseFollowerCountHint(resolved.socialContext) ?? 0,
      followingCount: 0,
      postsCount: 0,
      isPrivate: resolved.isPrivate,
      isVerified: resolved.isVerified,
    };
  }
}

async function fetchPublicGraphqlList(
  userId: string,
  kind: FriendshipKind,
  maxUsers: number,
  options?: { stopWhenFoundAllIds?: Set<string> },
): Promise<ListFetchResult> {
  const queryHash =
    kind === "followers" ? FOLLOWERS_QUERY_HASH : FOLLOWING_QUERY_HASH;
  const edgeKey = kind === "followers" ? "edge_followed_by" : "edge_follow";
  const sessionId = getInstagramSessionId();
  const csrfToken = getInstagramCsrfToken() ?? randomUUID().replace(/-/g, "");

  const users: InstagramUserSummary[] = [];
  const seen = new Set<string>();
  let endCursor: string | undefined;
  let truncated = false;
  let emptyRetries = 0;
  let pagesScanned = 0;
  const foundStopIds = new Set<string>();

  while (users.length < maxUsers) {
    const variables: Record<string, unknown> = {
      id: userId,
      include_reel: true,
      fetch_mutual: false,
      first: Math.min(PAGE_SIZE, maxUsers - users.length),
    };
    if (endCursor) variables.after = endCursor;

    const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
    pagesScanned += 1;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        headers: browserHeaders(undefined, sessionId, csrfToken),
        cache: "no-store",
        timeoutMs: REQUEST_TIMEOUT_MS,
        dispatcher: getInstagramDispatcher(),
      });
    } catch (error) {
      if (users.length > 0) {
        truncated = true;
        break;
      }
      throw error;
    }

    if (response.status === 429) {
      emptyRetries += 1;
      if (emptyRetries > MAX_EMPTY_RETRIES) {
        if (users.length > 0) {
          truncated = true;
          break;
        }
        throw new Error(
          "Instagram rate-limited list pagination. Wait a minute and retry.",
        );
      }
      await sleep(1_200 * emptyRetries);
      continue;
    }

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
      if (users.length > 0) {
        truncated = true;
        break;
      }
      throw new Error(payload.message ?? `Instagram ${kind} lookup failed.`);
    }

    const connection = payload.data?.user?.[edgeKey];
    const edges = connection?.edges ?? [];
    let added = 0;

    for (const edge of edges) {
      if (!edge.node) continue;
      const mapped = mapUserSummary(edge.node);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      users.push(mapped);
      if (options?.stopWhenFoundAllIds?.has(mapped.id)) {
        foundStopIds.add(mapped.id);
      }
      added += 1;
      if (users.length >= maxUsers) break;
    }

    const pageInfo = connection?.page_info;
    if (
      options?.stopWhenFoundAllIds &&
      foundStopIds.size >= options.stopWhenFoundAllIds.size
    ) {
      truncated = Boolean(pageInfo?.has_next_page);
      return { users, truncated, pagesScanned, stoppedAfterFindingIds: true };
    }

    if (users.length >= maxUsers) {
      truncated = Boolean(pageInfo?.has_next_page);
      break;
    }

    if (!pageInfo?.has_next_page || !pageInfo.end_cursor) {
      break;
    }

    if (added === 0) {
      emptyRetries += 1;
      if (emptyRetries > MAX_EMPTY_RETRIES) {
        truncated = true;
        break;
      }
    } else {
      emptyRetries = 0;
    }

    endCursor = pageInfo.end_cursor;
    await sleep(LIST_PAGE_DELAY_MS);
  }

  return { users, truncated, pagesScanned };
}

async function fetchSessionRestList(
  userId: string,
  kind: FriendshipKind,
  maxUsers: number,
  options?: { stopWhenFoundAllIds?: Set<string> },
): Promise<ListFetchResult> {
  const { sessionId, csrfToken } = requireSession();
  const users: InstagramUserSummary[] = [];
  const seen = new Set<string>();
  let maxId: string | undefined;
  let truncated = false;
  let emptyRetries = 0;
  const rankToken = `${userId}_${randomUUID()}`;
  let pagesScanned = 0;
  const foundStopIds = new Set<string>();

  while (users.length < maxUsers) {
    const params = new URLSearchParams({
      count: String(Math.min(200, maxUsers - users.length)),
      search_surface: "follow_list_page",
      rank_token: rankToken,
    });
    if (maxId) params.set("max_id", maxId);

    const url = `https://www.instagram.com/api/v1/friendships/${userId}/${kind}/?${params.toString()}`;
    pagesScanned += 1;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        headers: browserHeaders(undefined, sessionId, csrfToken),
        cache: "no-store",
        timeoutMs: REQUEST_TIMEOUT_MS,
        dispatcher: getInstagramDispatcher(),
      });
    } catch (error) {
      if (users.length > 0) {
        truncated = true;
        break;
      }
      throw error;
    }

    if (response.status === 429) {
      emptyRetries += 1;
      if (emptyRetries > MAX_EMPTY_RETRIES) {
        if (users.length > 0) {
          truncated = true;
          break;
        }
        throw new Error(
          "Instagram rate-limited list pagination. Wait a minute and retry.",
        );
      }
      await sleep(1_200 * emptyRetries);
      continue;
    }

    const payload = (await parseJsonResponse(response)) as {
      users?: Array<Record<string, unknown>>;
      next_max_id?: string | number;
      message?: string;
      status?: string;
    };

    if (!response.ok || payload.status === "fail") {
      if (users.length > 0) {
        truncated = true;
        break;
      }
      throw new Error(payload.message ?? `Instagram ${kind} lookup failed.`);
    }

    const chunk = payload.users ?? [];
    let added = 0;
    for (const raw of chunk) {
      const mapped = mapUserSummary(raw);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      users.push(mapped);
      if (options?.stopWhenFoundAllIds?.has(mapped.id)) {
        foundStopIds.add(mapped.id);
      }
      added += 1;
      if (users.length >= maxUsers) break;
    }

    const nextMaxId =
      payload.next_max_id === undefined || payload.next_max_id === null
        ? undefined
        : String(payload.next_max_id);

    if (
      options?.stopWhenFoundAllIds &&
      foundStopIds.size >= options.stopWhenFoundAllIds.size
    ) {
      truncated = Boolean(nextMaxId);
      return { users, truncated, pagesScanned, stoppedAfterFindingIds: true };
    }

    if (users.length >= maxUsers) {
      truncated = Boolean(nextMaxId);
      break;
    }

    // Instagram often returns a short first page with no cursor for huge
    // celebrity follower lists — treat that as incomplete so GraphQL can take over.
    if (!nextMaxId) {
      if (added === 0 && users.length === 0) {
        emptyRetries += 1;
        if (emptyRetries > MAX_EMPTY_RETRIES) break;
        await sleep(400 * emptyRetries);
        continue;
      }
      break;
    }

    maxId = nextMaxId;
    emptyRetries = 0;
    await sleep(LIST_PAGE_DELAY_MS);
  }

  return { users, truncated, pagesScanned };
}

async function fetchFriendshipList(
  userId: string,
  kind: FriendshipKind,
  maxUsers: number,
  profileIsPrivate: boolean,
  reportedTotal?: number,
  options?: { stopWhenFoundAllIds?: Set<string> },
): Promise<{ result: ListFetchResult; authMode: InstagramSearchResult["authMode"] }> {
  const target = Math.min(
    maxUsers,
    reportedTotal && reportedTotal > 0 ? reportedTotal : maxUsers,
  );

  // GraphQL paginates large follower lists; REST often stops after ~40 with no cursor.
  if (getInstagramSessionId() || !profileIsPrivate) {
    try {
      const graphql = await fetchPublicGraphqlList(userId, kind, target, options);
      const looksComplete =
        !graphql.truncated &&
        (reportedTotal === undefined ||
          reportedTotal <= 0 ||
          graphql.users.length >= Math.min(target, reportedTotal) ||
          graphql.users.length >= target);

      if (graphql.users.length > 0 && (looksComplete || graphql.users.length >= 100)) {
        return {
          result: graphql,
          authMode: getInstagramSessionId() ? "session" : "public",
        };
      }

      if (getInstagramSessionId()) {
        const rest = await fetchSessionRestList(userId, kind, target, options);
        if (rest.users.length > graphql.users.length) {
          return { result: rest, authMode: "session" };
        }
      }

      if (graphql.users.length > 0) {
        return {
          result: graphql,
          authMode: getInstagramSessionId() ? "session" : "public",
        };
      }
    } catch (graphqlError) {
      if (getInstagramSessionId()) {
        try {
          const rest = await fetchSessionRestList(userId, kind, target, options);
          return { result: rest, authMode: "session" };
        } catch {
          throw graphqlError;
        }
      }
      if (profileIsPrivate) throw graphqlError;
    }
  }

  if (getInstagramSessionId()) {
    const rest = await fetchSessionRestList(userId, kind, target, options);
    return { result: rest, authMode: "session" };
  }

  if (profileIsPrivate) {
    return { result: { users: [], truncated: false }, authMode: "none" };
  }

  try {
    const result = await fetchPublicGraphqlList(userId, kind, target, options);
    return { result, authMode: "public" };
  } catch {
    return { result: { users: [], truncated: false }, authMode: "none" };
  }
}

/**
 * Fetches the "following" list of an arbitrary account (used for second-degree
 * mutual analysis). Bounded by `cap` and tolerant of partial results.
 */
export async function fetchFriendshipListForSecondDegree(
  userId: string,
  cap: number,
): Promise<InstagramUserSummary[]> {
  const { result } = await fetchFriendshipList(
    userId,
    "following",
    cap,
    false,
    undefined,
  );
  return result.users;
}

function computeMutuals(
  followers: InstagramUserSummary[],
  following: InstagramUserSummary[],
): InstagramUserSummary[] {
  const followerIds = new Set(followers.map((user) => user.id));
  return following.filter((user) => followerIds.has(user.id));
}

export async function enrichInstagramUsersWithBios(
  users: InstagramUserSummary[],
  options?: { limit?: number },
): Promise<InstagramUserSummary[]> {
  const limit = Math.min(
    Math.max(options?.limit ?? DEFAULT_BIO_ENRICH_LIMIT, 1),
    120,
  );
  const targets = users.slice(0, limit);
  const enriched: InstagramUserSummary[] = [];

  for (let i = 0; i < targets.length; i += BIO_ENRICH_CONCURRENCY) {
    const batch = targets.slice(i, i + BIO_ENRICH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (user) => {
        try {
          const profile = await fetchInstagramUserInfoById(user.id, user.username);
          return {
            ...user,
            fullName: profile.fullName || user.fullName,
            profilePicUrl: profile.profilePicUrl ?? user.profilePicUrl,
            biography: profile.biography,
            externalUrl: profile.externalUrl,
            category: profile.category,
            isPrivate: profile.isPrivate,
            isVerified: profile.isVerified,
            followerCount: profile.followersCount,
            followingCount: profile.followingCount,
          } satisfies InstagramUserSummary;
        } catch {
          return user;
        }
      }),
    );
    enriched.push(...results);
    if (i + BIO_ENRICH_CONCURRENCY < targets.length) {
      await sleep(200);
    }
  }

  const enrichedIds = new Set(enriched.map((user) => user.id));
  return [
    ...enriched,
    ...users.filter((user) => !enrichedIds.has(user.id)),
  ];
}

export async function probeInstagramAvailability(): Promise<boolean> {
  if (!getInstagramSessionId()) return false;

  try {
    const { sessionId, csrfToken } = requireSession();
    const response = await fetchWithTimeout(
      "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      {
        headers: browserHeaders(undefined, sessionId, csrfToken),
        cache: "no-store",
        timeoutMs: 8_000,
        dispatcher: getInstagramDispatcher(),
      },
    );
    return response.ok || response.status === 429;
  } catch {
    return true;
  }
}

export async function searchInstagram(
  rawQuery: string,
  options?: {
    maxUsers?: number;
    lists?: "both" | "followers" | "following";
    enrichBios?: boolean;
    bioLimit?: number;
    mutualFirst?: boolean;
    includeActivity?: boolean;
    maxPosts?: number;
    maxTagged?: number;
    commentPosts?: number;
    secondDegree?: boolean;
    secondDegreeBudget?: number;
  },
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

  const { ensureInstagramSession, isInstagramAuthError } = await import(
    "@/lib/instagram-reauth"
  );
  const sessionGate = await ensureInstagramSession();
  if (sessionGate.refreshed) {
    warnings.push(
      sessionGate.message || "Instagram session was automatically refreshed.",
    );
  }

  let profile: InstagramProfile;
  try {
    // Rotate accounts / back off on rate-limit or challenge before giving up.
    profile = await withInstagramRateLimitRetry(() =>
      fetchInstagramProfile(username),
    );
  } catch (error) {
    if (!isInstagramAuthError(error)) throw error;
    const refreshed = await ensureInstagramSession({ force: true });
    if (!refreshed.ok) {
      throw new Error(
        refreshed.message ||
          (error instanceof Error ? error.message : "Instagram session expired."),
      );
    }
    warnings.push(
      refreshed.message || "Instagram session was automatically refreshed.",
    );
    profile = await fetchInstagramProfile(username);
  }

  const leaksRaw = await fetchGodsEyeSearchSafe("instagram", username)
    .then((data) => sanitizeGodsEyeSearch(data))
    .catch(() => ({ count: 0, results: [] as unknown[] }));

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
  let followersPagesScanned = 0;
  let followingPagesScanned = 0;
  let stoppedAfterFindingMutualCandidates = false;
  const mutualFirst = options?.mutualFirst ?? lists === "both";

  if (mutualFirst && lists === "both") {
    const followingEntry = await fetchFriendshipList(
      profile.id,
      "following",
      maxUsers,
      profile.isPrivate,
      profile.followingCount,
    );
    following = followingEntry.result.users;
    followingTruncated = followingEntry.result.truncated;
    followingPagesScanned = followingEntry.result.pagesScanned ?? 0;
    authMode = followingEntry.authMode;

    const candidateIds = new Set(following.map((user) => user.id));
    const followerEntry = await fetchFriendshipList(
      profile.id,
      "followers",
      maxUsers,
      profile.isPrivate,
      profile.followersCount,
      candidateIds.size > 0 ? { stopWhenFoundAllIds: candidateIds } : undefined,
    );
    followers = followerEntry.result.users;
    followersTruncated = followerEntry.result.truncated;
    followersPagesScanned = followerEntry.result.pagesScanned ?? 0;
    stoppedAfterFindingMutualCandidates = Boolean(
      followerEntry.result.stoppedAfterFindingIds,
    );
    if (followerEntry.authMode !== "none") authMode = followerEntry.authMode;
  } else {
    const listJobs: Array<
      Promise<{
        kind: FriendshipKind;
        result: ListFetchResult;
        authMode: InstagramSearchResult["authMode"];
      }>
    > = [];

    if (lists === "both" || lists === "followers") {
      listJobs.push(
        fetchFriendshipList(
          profile.id,
          "followers",
          maxUsers,
          profile.isPrivate,
          profile.followersCount,
        ).then((entry) => ({ kind: "followers" as const, ...entry })),
      );
    }

    if (lists === "both" || lists === "following") {
      listJobs.push(
        fetchFriendshipList(
          profile.id,
          "following",
          maxUsers,
          profile.isPrivate,
          profile.followingCount,
        ).then((entry) => ({ kind: "following" as const, ...entry })),
      );
    }

    const listResults = await Promise.all(listJobs);
    for (const entry of listResults) {
      if (entry.kind === "followers") {
        followers = entry.result.users;
        followersTruncated = entry.result.truncated;
        followersPagesScanned = entry.result.pagesScanned ?? 0;
      } else {
        following = entry.result.users;
        followingTruncated = entry.result.truncated;
        followingPagesScanned = entry.result.pagesScanned ?? 0;
      }
      if (entry.authMode !== "none") {
        authMode = entry.authMode;
      }
    }
  }

  let mutuals = computeMutuals(followers, following);

  if (options?.enrichBios) {
    const priority = [
      ...mutuals,
      ...following.filter((user) => !mutuals.some((m) => m.id === user.id)),
      ...followers.filter(
        (user) =>
          !mutuals.some((m) => m.id === user.id) &&
          !following.some((f) => f.id === user.id),
      ),
    ];
    const enriched = await enrichInstagramUsersWithBios(priority, {
      limit: options.bioLimit ?? DEFAULT_BIO_ENRICH_LIMIT,
    });
    const byId = new Map(enriched.map((user) => [user.id, user]));
    followers = followers.map((user) => byId.get(user.id) ?? user);
    following = following.map((user) => byId.get(user.id) ?? user);
    mutuals = computeMutuals(followers, following);
  }

  if (!getInstagramSessionId() && authMode === "none" && !profile.isPrivate) {
    warnings.push(
      "Instagram blocked unauthenticated list access from this server. Set INSTAGRAM_SESSION_ID to unlock follower and following export.",
    );
  }

  if (followersTruncated || followingTruncated) {
    warnings.push(
      `Lists were capped at ${maxUsers.toLocaleString()} accounts (hard limit). Partial pages may also stop early if Instagram rate-limits.`,
    );
  }

  if (
    !followersTruncated &&
    profile.followersCount > followers.length &&
    followers.length > 0 &&
    (lists === "both" || lists === "followers")
  ) {
    warnings.push(
      `Fetched ${followers.length.toLocaleString()} / ${profile.followersCount.toLocaleString()} followers before Instagram stopped paginating.`,
    );
  }

  if (
    !followingTruncated &&
    profile.followingCount > following.length &&
    following.length > 0 &&
    (lists === "both" || lists === "following")
  ) {
    warnings.push(
      `Fetched ${following.length.toLocaleString()} / ${profile.followingCount.toLocaleString()} following before Instagram stopped paginating.`,
    );
  }

  let activity: InstagramActivityGraph | null = null;
  if (options?.includeActivity !== false && getInstagramSessionId()) {
    try {
      activity = await fetchInstagramActivityGraph(profile.id, username, {
        maxPosts: options?.maxPosts,
        maxTagged: options?.maxTagged,
        commentPosts: options?.commentPosts,
      });
      warnings.push(...activity.warnings);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Activity scan failed: ${error.message}`
          : "Activity scan failed.",
      );
    }
  }

  let secondDegree: SecondDegreeGraph | null = null;
  if (options?.secondDegree && getInstagramSessionId() && mutuals.length >= 3) {
    try {
      const { computeSecondDegreeMutuals } = await import(
        "@/lib/instagram-second-degree"
      );
      secondDegree = await computeSecondDegreeMutuals(mutuals, {
        maxMutualsToProbe: options.secondDegreeBudget ?? 18,
      });
      warnings.push(...secondDegree.warnings);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Second-degree analysis failed: ${error.message}`
          : "Second-degree analysis failed.",
      );
    }
  }

  return {
    query: username,
    profile,
    followers,
    following,
    mutuals,
    activity,
    secondDegree,
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
    discovery: {
      mutualFirst,
      followersPagesScanned,
      followingPagesScanned,
      stoppedAfterFindingMutualCandidates,
    },
    authMode,
  };
}
