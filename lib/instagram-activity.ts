import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  browserHeaders,
  getInstagramSessionId,
  requireSession,
  sleep,
  type InstagramUserSummary,
} from "@/lib/instagram-search";

const REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_POSTS = 24;
const DEFAULT_MAX_TAGGED = 24;
const DEFAULT_COMMENT_POSTS = 8;
const DEFAULT_COMMENTS_PER_POST = 40;
const PAGE_DELAY_MS = 350;

export type InstagramPostLocation = {
  id?: string;
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
};

export type InstagramActivityAccount = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  isVerified: boolean;
  isPrivate?: boolean;
};

export type InstagramPostSummary = {
  id: string;
  code?: string;
  url: string;
  takenAt: number;
  takenAtIso: string;
  caption?: string;
  commentCount: number;
  likeCount?: number;
  location?: InstagramPostLocation;
  taggedUsers: InstagramActivityAccount[];
  coauthors: InstagramActivityAccount[];
  owner?: InstagramActivityAccount;
  source: "own" | "tagged";
};

export type InstagramLocationVisit = {
  location: InstagramPostLocation;
  firstSeenAt: number;
  lastSeenAt: number;
  firstSeenIso: string;
  lastSeenIso: string;
  visitCount: number;
  postCodes: string[];
  postUrls: string[];
  sources: Array<"own" | "tagged">;
};

export type InstagramCommenterSignal = {
  account: InstagramActivityAccount;
  commentCount: number;
  postCount: number;
  sampleComments: string[];
  postCodes: string[];
  consistencyScore: number;
};

export type InstagramTagSignal = {
  account: InstagramActivityAccount;
  taggedInOwnPosts: number;
  taggedSubjectInTheirPosts: number;
  coauthorCount: number;
  mentionCount: number;
  score: number;
};

export type InstagramActivityGraph = {
  postsAnalyzed: number;
  taggedPostsAnalyzed: number;
  commentsScanned: number;
  posts: InstagramPostSummary[];
  taggedPosts: InstagramPostSummary[];
  locations: InstagramLocationVisit[];
  consistentCommenters: InstagramCommenterSignal[];
  taggedAccounts: InstagramTagSignal[];
  closeFriendCandidates: Array<{
    account: InstagramActivityAccount;
    score: number;
    reasons: string[];
  }>;
  warnings: string[];
};

function toIso(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "";
  return new Date(unixSeconds * 1000).toISOString();
}

function mapAccount(raw: Record<string, unknown> | undefined): InstagramActivityAccount | null {
  if (!raw) return null;
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

function mapLocation(raw: unknown): InstagramPostLocation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const location = raw as Record<string, unknown>;
  const name = String(location.name ?? "").trim();
  if (!name) return undefined;
  return {
    id: location.pk != null || location.id != null
      ? String(location.pk ?? location.id)
      : undefined,
    name,
    city: typeof location.city === "string" ? location.city : undefined,
    lat: typeof location.lat === "number" ? location.lat : undefined,
    lng: typeof location.lng === "number" ? location.lng : undefined,
  };
}

function extractMentions(caption: string): string[] {
  return Array.from(caption.matchAll(/@([A-Za-z0-9._]{2,30})/g)).map(
    (match) => match[1].toLowerCase(),
  );
}

function mapPost(
  raw: Record<string, unknown>,
  source: "own" | "tagged",
): InstagramPostSummary | null {
  const id = String(raw.pk ?? raw.id ?? "").trim();
  if (!id) return null;
  const code = typeof raw.code === "string" ? raw.code : undefined;
  const takenAt = Number(raw.taken_at ?? 0);
  const captionObj = raw.caption as { text?: string } | undefined;
  const caption = captionObj?.text?.trim() || undefined;
  const usertags = raw.usertags as
    | { in?: Array<{ user?: Record<string, unknown> }> }
    | undefined;
  const coauthorsRaw = Array.isArray(raw.coauthor_producers)
    ? (raw.coauthor_producers as Array<Record<string, unknown>>)
    : [];

  const taggedUsers = (usertags?.in ?? [])
    .map((entry) => mapAccount(entry.user))
    .filter((account): account is InstagramActivityAccount => Boolean(account));

  const coauthors = coauthorsRaw
    .map((entry) => mapAccount(entry))
    .filter((account): account is InstagramActivityAccount => Boolean(account));

  return {
    id,
    code,
    url: code
      ? `https://www.instagram.com/p/${code}/`
      : `https://www.instagram.com/`,
    takenAt,
    takenAtIso: toIso(takenAt),
    caption,
    commentCount: Number(raw.comment_count ?? 0),
    likeCount:
      typeof raw.like_count === "number" ? raw.like_count : undefined,
    location: mapLocation(raw.location),
    taggedUsers,
    coauthors,
    owner: mapAccount(raw.user as Record<string, unknown> | undefined) ?? undefined,
    source,
  };
}

async function igGetJson(url: string, usernameHint?: string): Promise<unknown> {
  const { sessionId, csrfToken } = requireSession();
  const response = await fetchWithTimeout(url, {
    headers: browserHeaders(usernameHint, sessionId, csrfToken),
    cache: "no-store",
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.status === 429
        ? "Instagram rate-limited media requests."
        : `Instagram returned an empty media response (${response.status}).`,
    );
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "Instagram returned an HTML challenge page while loading media. Try again shortly.",
    );
  }
  try {
    const payload = JSON.parse(text) as unknown;
    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload &&
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Instagram media request failed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Instagram")) {
      throw error;
    }
    throw new Error("Instagram returned unexpected media JSON.");
  }
}

async function fetchPaginatedFeed(
  urlFactory: (maxId?: string) => string,
  source: "own" | "tagged",
  maxItems: number,
  usernameHint?: string,
): Promise<{ posts: InstagramPostSummary[]; truncated: boolean }> {
  const posts: InstagramPostSummary[] = [];
  const seen = new Set<string>();
  let maxId: string | undefined;
  let truncated = false;

  while (posts.length < maxItems) {
    const payload = (await igGetJson(urlFactory(maxId), usernameHint)) as {
      items?: Array<Record<string, unknown>>;
      more_available?: boolean;
      next_max_id?: string | number;
    };

    for (const raw of payload.items ?? []) {
      const mapped = mapPost(raw, source);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      posts.push(mapped);
      if (posts.length >= maxItems) break;
    }

    if (!payload.more_available || !payload.next_max_id || posts.length >= maxItems) {
      truncated = Boolean(payload.more_available && posts.length >= maxItems);
      break;
    }

    maxId = String(payload.next_max_id);
    await sleep(PAGE_DELAY_MS);
  }

  return { posts, truncated };
}

async function fetchCommentsForPost(
  mediaId: string,
  maxComments: number,
  usernameHint?: string,
): Promise<Array<{ account: InstagramActivityAccount; text: string; createdAt: number }>> {
  const comments: Array<{
    account: InstagramActivityAccount;
    text: string;
    createdAt: number;
  }> = [];
  let minId: string | undefined;
  let pages = 0;

  while (comments.length < maxComments && pages < 3) {
    pages += 1;
    const params = new URLSearchParams({
      can_support_threading: "true",
      permalink_enabled: "false",
    });
    if (minId) params.set("min_id", minId);

    const payload = (await igGetJson(
      `https://www.instagram.com/api/v1/media/${mediaId}/comments/?${params.toString()}`,
      usernameHint,
    )) as {
      comments?: Array<Record<string, unknown>>;
      next_min_id?: string;
      has_more_comments?: boolean;
    };

    for (const raw of payload.comments ?? []) {
      const account = mapAccount(raw.user as Record<string, unknown> | undefined);
      if (!account) continue;
      comments.push({
        account,
        text: String(raw.text ?? "").trim(),
        createdAt: Number(raw.created_at ?? 0),
      });
      if (comments.length >= maxComments) break;
    }

    if (!payload.has_more_comments || !payload.next_min_id) break;
    minId = payload.next_min_id;
    await sleep(PAGE_DELAY_MS);
  }

  return comments;
}

function buildLocationVisits(posts: InstagramPostSummary[]): InstagramLocationVisit[] {
  const byKey = new Map<string, InstagramLocationVisit>();

  for (const post of posts) {
    if (!post.location) continue;
    const key = `${post.location.id ?? post.location.name.toLowerCase()}|${post.location.lat ?? ""}|${post.location.lng ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        location: post.location,
        firstSeenAt: post.takenAt,
        lastSeenAt: post.takenAt,
        firstSeenIso: post.takenAtIso,
        lastSeenIso: post.takenAtIso,
        visitCount: 1,
        postCodes: post.code ? [post.code] : [],
        postUrls: [post.url],
        sources: [post.source],
      });
      continue;
    }

    existing.visitCount += 1;
    if (post.takenAt && (existing.firstSeenAt === 0 || post.takenAt < existing.firstSeenAt)) {
      existing.firstSeenAt = post.takenAt;
      existing.firstSeenIso = post.takenAtIso;
    }
    if (post.takenAt > existing.lastSeenAt) {
      existing.lastSeenAt = post.takenAt;
      existing.lastSeenIso = post.takenAtIso;
    }
    if (post.code && !existing.postCodes.includes(post.code)) {
      existing.postCodes.push(post.code);
    }
    if (!existing.postUrls.includes(post.url)) existing.postUrls.push(post.url);
    if (!existing.sources.includes(post.source)) existing.sources.push(post.source);
  }

  return [...byKey.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

function bumpAccount(
  map: Map<string, InstagramTagSignal>,
  account: InstagramActivityAccount,
  field: keyof Pick<
    InstagramTagSignal,
    "taggedInOwnPosts" | "taggedSubjectInTheirPosts" | "coauthorCount" | "mentionCount"
  >,
) {
  const existing = map.get(account.id) ?? {
    account,
    taggedInOwnPosts: 0,
    taggedSubjectInTheirPosts: 0,
    coauthorCount: 0,
    mentionCount: 0,
    score: 0,
  };
  existing.account = {
    ...existing.account,
    ...account,
    fullName: account.fullName || existing.account.fullName,
    profilePicUrl: account.profilePicUrl ?? existing.account.profilePicUrl,
  };
  existing[field] += 1;
  map.set(account.id, existing);
}

export async function fetchInstagramActivityGraph(
  userId: string,
  username: string,
  options?: {
    maxPosts?: number;
    maxTagged?: number;
    commentPosts?: number;
    commentsPerPost?: number;
  },
): Promise<InstagramActivityGraph> {
  if (!getInstagramSessionId()) {
    return {
      postsAnalyzed: 0,
      taggedPostsAnalyzed: 0,
      commentsScanned: 0,
      posts: [],
      taggedPosts: [],
      locations: [],
      consistentCommenters: [],
      taggedAccounts: [],
      closeFriendCandidates: [],
      warnings: [
        "Post/tag/comment activity requires INSTAGRAM_SESSION_ID.",
      ],
    };
  }

  const maxPosts = Math.min(Math.max(options?.maxPosts ?? DEFAULT_MAX_POSTS, 1), 100);
  const maxTagged = Math.min(Math.max(options?.maxTagged ?? DEFAULT_MAX_TAGGED, 1), 100);
  const commentPosts = Math.min(
    Math.max(options?.commentPosts ?? DEFAULT_COMMENT_POSTS, 0),
    maxPosts,
  );
  const commentsPerPost = Math.min(
    Math.max(options?.commentsPerPost ?? DEFAULT_COMMENTS_PER_POST, 1),
    100,
  );
  const warnings: string[] = [];

  const [ownFeed, taggedFeed] = await Promise.all([
    fetchPaginatedFeed(
      (maxId) => {
        const params = new URLSearchParams({ count: "12" });
        if (maxId) params.set("max_id", maxId);
        return `https://www.instagram.com/api/v1/feed/user/${userId}/?${params}`;
      },
      "own",
      maxPosts,
      username,
    ).catch((error) => {
      warnings.push(
        error instanceof Error ? error.message : "Failed to load own posts.",
      );
      return { posts: [] as InstagramPostSummary[], truncated: false };
    }),
    fetchPaginatedFeed(
      (maxId) => {
        const params = new URLSearchParams({ count: "12" });
        if (maxId) params.set("max_id", maxId);
        return `https://www.instagram.com/api/v1/usertags/${userId}/feed/?${params}`;
      },
      "tagged",
      maxTagged,
      username,
    ).catch((error) => {
      warnings.push(
        error instanceof Error ? error.message : "Failed to load tagged posts.",
      );
      return { posts: [] as InstagramPostSummary[], truncated: false };
    }),
  ]);

  if (ownFeed.truncated) {
    warnings.push(`Own posts capped at ${maxPosts}.`);
  }
  if (taggedFeed.truncated) {
    warnings.push(`Tagged posts capped at ${maxTagged}.`);
  }

  const posts = ownFeed.posts;
  const taggedPosts = taggedFeed.posts;
  const allPosts = [...posts, ...taggedPosts];

  const tagSignals = new Map<string, InstagramTagSignal>();
  for (const post of posts) {
    for (const account of post.taggedUsers) {
      bumpAccount(tagSignals, account, "taggedInOwnPosts");
    }
    for (const account of post.coauthors) {
      bumpAccount(tagSignals, account, "coauthorCount");
    }
    for (const mention of extractMentions(post.caption ?? "")) {
      const existing = [...tagSignals.values()].find(
        (signal) => signal.account.username.toLowerCase() === mention,
      );
      if (existing) {
        existing.mentionCount += 1;
      } else {
        bumpAccount(
          tagSignals,
          {
            id: `mention:${mention}`,
            username: mention,
            fullName: "",
            isVerified: false,
          },
          "mentionCount",
        );
      }
    }
  }

  for (const post of taggedPosts) {
    if (post.owner) {
      bumpAccount(tagSignals, post.owner, "taggedSubjectInTheirPosts");
    }
  }

  for (const signal of tagSignals.values()) {
    signal.score =
      signal.taggedInOwnPosts * 3 +
      signal.taggedSubjectInTheirPosts * 4 +
      signal.coauthorCount * 3 +
      signal.mentionCount * 1;
  }

  const commenterMap = new Map<
    string,
    {
      account: InstagramActivityAccount;
      commentCount: number;
      posts: Set<string>;
      sampleComments: string[];
      postCodes: string[];
    }
  >();

  let commentsScanned = 0;
  const postsForComments = posts
    .filter((post) => post.commentCount > 0)
    .slice(0, commentPosts);

  for (const post of postsForComments) {
    try {
      const comments = await fetchCommentsForPost(
        post.id,
        commentsPerPost,
        username,
      );
      commentsScanned += comments.length;
      for (const comment of comments) {
        if (comment.account.id === userId) continue;
        const existing = commenterMap.get(comment.account.id) ?? {
          account: comment.account,
          commentCount: 0,
          posts: new Set<string>(),
          sampleComments: [],
          postCodes: [],
        };
        existing.commentCount += 1;
        existing.posts.add(post.id);
        if (post.code && !existing.postCodes.includes(post.code)) {
          existing.postCodes.push(post.code);
        }
        if (
          comment.text &&
          existing.sampleComments.length < 3 &&
          !existing.sampleComments.includes(comment.text)
        ) {
          existing.sampleComments.push(comment.text.slice(0, 140));
        }
        commenterMap.set(comment.account.id, existing);
      }
      await sleep(PAGE_DELAY_MS);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Comments for ${post.code ?? post.id}: ${error.message}`
          : "Comment scan failed on one post.",
      );
      break;
    }
  }

  const consistentCommenters: InstagramCommenterSignal[] = [...commenterMap.values()]
    .map((entry) => ({
      account: entry.account,
      commentCount: entry.commentCount,
      postCount: entry.posts.size,
      sampleComments: entry.sampleComments,
      postCodes: entry.postCodes,
      consistencyScore: entry.posts.size * 4 + entry.commentCount,
    }))
    .filter((entry) => entry.postCount >= 2 || entry.commentCount >= 3)
    .sort((a, b) => b.consistencyScore - a.consistencyScore)
    .slice(0, 40);

  const taggedAccounts = [...tagSignals.values()]
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);

  const candidateMap = new Map<
    string,
    {
      account: InstagramActivityAccount;
      score: number;
      reasons: string[];
    }
  >();

  function addCandidate(
    account: InstagramActivityAccount,
    points: number,
    reason: string,
  ) {
    if (!account.id || account.id === userId) return;
    const existing = candidateMap.get(account.id) ?? {
      account,
      score: 0,
      reasons: [],
    };
    existing.account = {
      ...existing.account,
      ...account,
      fullName: account.fullName || existing.account.fullName,
      profilePicUrl: account.profilePicUrl ?? existing.account.profilePicUrl,
    };
    existing.score += points;
    if (!existing.reasons.includes(reason) && existing.reasons.length < 6) {
      existing.reasons.push(reason);
    }
    candidateMap.set(account.id, existing);
  }

  for (const signal of taggedAccounts) {
    if (signal.taggedInOwnPosts > 0) {
      addCandidate(
        signal.account,
        signal.taggedInOwnPosts * 3,
        `tagged in ${signal.taggedInOwnPosts} of their posts`,
      );
    }
    if (signal.taggedSubjectInTheirPosts > 0) {
      addCandidate(
        signal.account,
        signal.taggedSubjectInTheirPosts * 4,
        `subject tagged in ${signal.taggedSubjectInTheirPosts} of their posts`,
      );
    }
    if (signal.coauthorCount > 0) {
      addCandidate(
        signal.account,
        signal.coauthorCount * 3,
        `coauthored ${signal.coauthorCount} posts`,
      );
    }
  }

  for (const commenter of consistentCommenters) {
    addCandidate(
      commenter.account,
      commenter.consistencyScore,
      `commented on ${commenter.postCount} posts (${commenter.commentCount} comments)`,
    );
  }

  const closeFriendCandidates = [...candidateMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  return {
    postsAnalyzed: posts.length,
    taggedPostsAnalyzed: taggedPosts.length,
    commentsScanned,
    posts,
    taggedPosts,
    locations: buildLocationVisits(allPosts),
    consistentCommenters,
    taggedAccounts,
    closeFriendCandidates,
    warnings,
  };
}

export function activityAccountsAsSummaries(
  activity: InstagramActivityGraph,
): InstagramUserSummary[] {
  const byId = new Map<string, InstagramUserSummary>();

  const push = (account: InstagramActivityAccount) => {
    if (!account.id || account.id.startsWith("mention:")) return;
    byId.set(account.id, {
      id: account.id,
      username: account.username,
      fullName: account.fullName,
      profilePicUrl: account.profilePicUrl,
      isVerified: account.isVerified,
      isPrivate: account.isPrivate,
    });
  };

  for (const candidate of activity.closeFriendCandidates) push(candidate.account);
  for (const commenter of activity.consistentCommenters) push(commenter.account);
  for (const tagged of activity.taggedAccounts) push(tagged.account);
  for (const post of activity.taggedPosts) {
    if (post.owner) push(post.owner);
  }

  return [...byId.values()];
}
