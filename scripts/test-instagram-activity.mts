import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { InstagramActivityGraph } from "../lib/instagram-activity";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const { buildInstagramBubbleMap } = await import("../lib/instagram-bubble-map");
const { fetchInstagramActivityGraph } = await import("../lib/instagram-activity");
const { fetchInstagramProfile, getInstagramSessionId } = await import(
  "../lib/instagram-search"
);

const syntheticActivity: InstagramActivityGraph = {
  postsAnalyzed: 3,
  taggedPostsAnalyzed: 2,
  commentsScanned: 12,
  posts: [],
  taggedPosts: [],
  locations: [
    {
      location: { name: "Blacksburg, Virginia", lat: 37.23, lng: -80.41 },
      firstSeenAt: 1_700_000_000,
      lastSeenAt: 1_710_000_000,
      firstSeenIso: "2023-11-14T00:00:00.000Z",
      lastSeenIso: "2024-03-09T00:00:00.000Z",
      visitCount: 2,
      postCodes: ["aaa", "bbb"],
      postUrls: ["https://www.instagram.com/p/aaa/"],
      sources: ["own", "tagged"],
    },
  ],
  consistentCommenters: [
    {
      account: {
        id: "99",
        username: "bestie99",
        fullName: "Best Friend",
        isVerified: false,
      },
      commentCount: 6,
      postCount: 3,
      sampleComments: ["miss you!!"],
      postCodes: ["aaa", "bbb", "ccc"],
      consistencyScore: 9,
    },
  ],
  taggedAccounts: [
    {
      account: {
        id: "88",
        username: "roomie88",
        fullName: "Roommate",
        isVerified: false,
      },
      taggedInOwnPosts: 4,
      taggedSubjectInTheirPosts: 2,
      coauthorCount: 1,
      mentionCount: 0,
      score: 10,
    },
  ],
  closeFriendCandidates: [
    {
      account: {
        id: "99",
        username: "bestie99",
        fullName: "Best Friend",
        isVerified: false,
      },
      score: 12,
      reasons: ["Commented on 3 posts", "High consistency"],
    },
    {
      account: {
        id: "88",
        username: "roomie88",
        fullName: "Roommate",
        isVerified: false,
      },
      score: 10,
      reasons: ["Tagged in 4 own posts", "Coauthored 1 post"],
    },
  ],
  warnings: [],
};

const map = buildInstagramBubbleMap({
  profile: {
    id: "1",
    username: "target",
    fullName: "Jordan Smith",
    biography: "VT 27",
    followersCount: 2,
    followingCount: 2,
    postsCount: 3,
    isPrivate: false,
    isVerified: false,
  },
  followers: [],
  following: [
    {
      id: "88",
      username: "roomie88",
      fullName: "Roommate",
      isVerified: false,
    },
  ],
  mutuals: [
    {
      id: "99",
      username: "bestie99",
      fullName: "Best Friend",
      isVerified: false,
    },
  ],
  activity: syntheticActivity,
});

const kinds = new Set(map.entities.map((entity) => entity.kind));
console.log("Synthetic kinds:", [...kinds].sort().join(", "));
console.log("Locations in stats:", map.stats.locationCount);
console.log("Commenters in stats:", map.stats.consistentCommenterCount);
console.log(
  "Insights:",
  map.insights.filter((line) => /Geotagged|commenter|Activity-based/i.test(line)),
);

if (!kinds.has("travel") || !kinds.has("consistent_commenter") || !kinds.has("tagged_together")) {
  throw new Error("Expected travel/commenter/tagged_together entities");
}

const username = process.argv[2] || "natgeo";
if (!getInstagramSessionId()) {
  console.log("No Instagram session — skipping live activity probe.");
  process.exit(0);
}

console.log(`\nLive activity probe for @${username}…`);
const profile = await fetchInstagramProfile(username);
if (!profile) {
  throw new Error(`Could not resolve @${username}`);
}

const activity = await fetchInstagramActivityGraph(profile.id, username, {
  maxPosts: 12,
  maxTagged: 12,
  commentPosts: 4,
  commentsPerPost: 20,
});

console.log({
  postsAnalyzed: activity.postsAnalyzed,
  taggedPostsAnalyzed: activity.taggedPostsAnalyzed,
  commentsScanned: activity.commentsScanned,
  locations: activity.locations.slice(0, 5).map((visit) => ({
    name: visit.location.name,
    first: visit.firstSeenIso.slice(0, 10),
    last: visit.lastSeenIso.slice(0, 10),
    count: visit.visitCount,
  })),
  topCommenters: activity.consistentCommenters.slice(0, 5).map((entry) => ({
    user: entry.account.username,
    posts: entry.postCount,
    comments: entry.commentCount,
    score: entry.consistencyScore,
  })),
  closeFriends: activity.closeFriendCandidates.slice(0, 5).map((entry) => ({
    user: entry.account.username,
    score: entry.score,
    reasons: entry.reasons,
  })),
  warnings: activity.warnings,
});
