import type { InstagramActivityGraph } from "@/lib/instagram-activity";
import type {
  InstagramProfile,
  InstagramUserSummary,
} from "@/lib/instagram-search";
import type { SecondDegreeGraph } from "@/lib/instagram-second-degree";

export type InterestTopic = {
  label: string;
  weight: number;
  /** Sample accounts (usernames) that drove this interest. */
  examples: string[];
};

export type InterestedInAccount = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  isVerified: boolean;
  category?: string;
  followerCount?: number;
  reason: string;
};

export type PersonHighlight = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
};

export type TagRelation = {
  username: string;
  fullName: string;
  count: number;
};

export type InstagramPersona = {
  headline: string;
  summary: string[];
  interests: InterestTopic[];
  interestedIn: InterestedInAccount[];
  mutualHighlights: PersonHighlight[];
  coreFriendGroup: Array<{
    username: string;
    fullName: string;
    profilePicUrl?: string;
    internalDegree: number;
  }>;
  tagRelationships: {
    youTag: TagRelation[];
    tagYou: TagRelation[];
    mutualTag: TagRelation[];
  };
  places: Array<{ name: string; lastSeenIso: string; visitCount: number }>;
  stats: {
    following: number;
    followers: number;
    mutuals: number;
    interestedInCount: number;
    creatorsFollowed: number;
    biosAnalyzed: number;
  };
};

type TopicRule = {
  label: string;
  patterns: RegExp[];
};

// Interest taxonomy — matched against the category + bio + name of accounts the
// subject follows. Ordered roughly by how distinctive each signal is.
const TOPIC_RULES: TopicRule[] = [
  {
    label: "Music",
    patterns: [
      /\b(musician|band|singer|rapper|dj|producer|guitarist|drummer|spotify|soundcloud|album|mixtape|record label|vocalist)\b/i,
      /🎵|🎶|🎸|🎤/,
    ],
  },
  {
    label: "Sports & fitness",
    patterns: [
      /\b(athlete|coach|gym|fitness|workout|trainer|nfl|nba|mlb|soccer|football|basketball|baseball|mma|ufc|boxing|crossfit|bodybuild|marathon|runner|cyclist)\b/i,
      /🏈|⚽|🏀|⚾|🥊|🏋️|💪/,
    ],
  },
  {
    label: "Gaming & esports",
    patterns: [
      /\b(gamer|gaming|twitch|esports|valorant|fortnite|minecraft|league of legends|call of duty|xbox|playstation|streamer|speedrun)\b/i,
      /🎮|🕹️/,
    ],
  },
  {
    label: "Tech & software",
    patterns: [
      /\b(developer|engineer|software|programmer|coder|startup|saas|ai|machine learning|data science|cybersecurity|hacker|tech|it professional)\b/i,
      /💻|⌨️/,
    ],
  },
  {
    label: "Crypto & finance",
    patterns: [
      /\b(crypto|bitcoin|ethereum|web3|nft|defi|trader|trading|stocks|investor|investing|forex|finance|wallstreet)\b/i,
      /📈|₿|💰/,
    ],
  },
  {
    label: "Fashion & beauty",
    patterns: [
      /\b(fashion|model|stylist|makeup|beauty|cosmetics|skincare|hairstylist|boutique|streetwear|designer|nails|mua)\b/i,
      /💄|👗|👠|💅/,
    ],
  },
  {
    label: "Food & cooking",
    patterns: [
      /\b(chef|restaurant|foodie|cooking|recipe|bakery|cafe|coffee|barista|bbq|culinary|kitchen|eats)\b/i,
      /🍳|🍔|🍕|☕|🍰/,
    ],
  },
  {
    label: "Travel",
    patterns: [
      /\b(travel|traveler|wanderlust|explore|adventure|backpack|nomad|destinations|globetrotter)\b/i,
      /✈️|🌍|🏝️|🗺️/,
    ],
  },
  {
    label: "Art & design",
    patterns: [
      /\b(artist|art|illustrator|designer|graphic design|painter|tattoo|sculpt|creative director|animation|3d artist)\b/i,
      /🎨|🖌️/,
    ],
  },
  {
    label: "Photography & film",
    patterns: [
      /\b(photographer|photography|videographer|filmmaker|cinematographer|director|editor|content creator|videos?)\b/i,
      /📷|📸|🎬|🎥/,
    ],
  },
  {
    label: "Cars & automotive",
    patterns: [
      /\b(car|cars|automotive|jdm|supercar|racing|motorsport|mechanic|drift|detailing|motorcycle|biker)\b/i,
      /🏎️|🚗|🏍️/,
    ],
  },
  {
    label: "Comedy & memes",
    patterns: [
      /\b(comedian|comedy|memes?|funny|humor|standup|satire|entertainer)\b/i,
      /😂|🤣/,
    ],
  },
  {
    label: "Business & entrepreneurship",
    patterns: [
      /\b(entrepreneur|founder|ceo|cofounder|business|marketing|agency|consultant|realtor|real estate|ecommerce|dropship|brand)\b/i,
      /💼|🏢/,
    ],
  },
  {
    label: "Education & science",
    patterns: [
      /\b(professor|teacher|educator|student|university|college|phd|researcher|science|scientist|academic|stem)\b/i,
      /🎓|🔬|📚/,
    ],
  },
  {
    label: "Anime & pop culture",
    patterns: [
      /\b(anime|manga|otaku|cosplay|weeb|kpop|k-pop|comics|marvel|fandom)\b/i,
    ],
  },
  {
    label: "Outdoors & nature",
    patterns: [
      /\b(hiking|hiker|camping|fishing|hunting|outdoors|nature|surf|snowboard|ski|climbing|mountain)\b/i,
      /🏔️|🎣|🏕️|🌲/,
    ],
  },
  {
    label: "Health & wellness",
    patterns: [
      /\b(wellness|yoga|meditation|nutrition|dietitian|therapist|mental health|mindful|holistic|nurse|doctor|medical)\b/i,
      /🧘|🩺/,
    ],
  },
  {
    label: "Faith & community",
    patterns: [
      /\b(church|ministry|faith|christian|muslim|jesus|god|worship|pastor|nonprofit|charity|volunteer)\b/i,
      /✝️|🕌|🙏/,
    ],
  },
  {
    label: "Pets & animals",
    patterns: [/\b(dog|cat|pet|puppy|kitten|animal|rescue|veterinar|horse|wildlife)\b/i, /🐶|🐱|🐾/],
  },
];

function analyzeText(text: string): string[] {
  const matched: string[] = [];
  for (const rule of TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matched.push(rule.label);
    }
  }
  return matched;
}

function accountText(user: InstagramUserSummary): string {
  return [user.category, user.biography, user.fullName]
    .filter(Boolean)
    .join(" \n ");
}

function isLikelyCreatorOrBrand(user: InstagramUserSummary): boolean {
  if (user.isVerified) return true;
  if (typeof user.followerCount === "number" && user.followerCount >= 30_000) {
    return true;
  }
  if (user.category && user.category.trim().length > 0) return true;
  return false;
}

export function buildInstagramPersona(input: {
  profile: InstagramProfile;
  followers: InstagramUserSummary[];
  following: InstagramUserSummary[];
  mutuals: InstagramUserSummary[];
  activity?: InstagramActivityGraph | null;
  secondDegree?: SecondDegreeGraph | null;
}): InstagramPersona {
  const { profile, followers, following, mutuals, activity, secondDegree } =
    input;

  const mutualIds = new Set(mutuals.map((user) => user.id));
  // Accounts the subject follows that do NOT follow back — "just interested in".
  const oneWayFollowing = following.filter((user) => !mutualIds.has(user.id));

  // ---- Interests ----
  const topicWeights = new Map<string, { weight: number; examples: string[] }>();

  const addTopics = (user: InstagramUserSummary, weight: number) => {
    const topics = analyzeText(accountText(user));
    for (const topic of topics) {
      const entry = topicWeights.get(topic) ?? { weight: 0, examples: [] };
      entry.weight += weight;
      if (entry.examples.length < 5 && !entry.examples.includes(user.username)) {
        entry.examples.push(user.username);
      }
      topicWeights.set(topic, entry);
    }
  };

  // One-way follows are the strongest interest signal (content/creators the
  // subject follows without a reciprocal friendship).
  for (const user of oneWayFollowing) addTopics(user, 2);
  // Mutuals still hint at the subject's social world, but weight them lower.
  for (const user of mutuals) addTopics(user, 1);
  // The subject's own bio is a direct self-declaration.
  const selfTopics = analyzeText(
    [profile.biography, profile.category, profile.fullName]
      .filter(Boolean)
      .join(" \n "),
  );
  for (const topic of selfTopics) {
    const entry = topicWeights.get(topic) ?? { weight: 0, examples: [] };
    entry.weight += 3;
    if (!entry.examples.includes("profile bio")) {
      entry.examples.unshift("profile bio");
    }
    topicWeights.set(topic, entry);
  }

  const interests: InterestTopic[] = [...topicWeights.entries()]
    .map(([label, value]) => ({
      label,
      weight: value.weight,
      examples: value.examples,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  // ---- Interested-in accounts (following-not-back) ----
  const interestedIn: InterestedInAccount[] = oneWayFollowing
    .map((user) => {
      const topics = analyzeText(accountText(user));
      const reason = user.category
        ? user.category
        : topics.length > 0
          ? topics.slice(0, 2).join(", ")
          : user.isVerified
            ? "verified — followed, no follow-back"
            : "followed, no follow-back";
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        profilePicUrl: user.profilePicUrl,
        isVerified: user.isVerified,
        category: user.category,
        followerCount: user.followerCount,
        reason,
      } satisfies InterestedInAccount;
    })
    .sort((a, b) => {
      // Verified + big accounts float up (clearest "interest" signals).
      const score = (item: InterestedInAccount) =>
        (item.isVerified ? 1_000_000_000 : 0) + (item.followerCount ?? 0);
      return score(b) - score(a);
    })
    .slice(0, 24);

  const creatorsFollowed = oneWayFollowing.filter(isLikelyCreatorOrBrand).length;

  // ---- Mutual highlights ----
  const mutualHighlights: PersonHighlight[] = mutuals.slice(0, 12).map((user) => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    profilePicUrl: user.profilePicUrl,
  }));

  // ---- Core friend group (second-degree interconnected mutuals) ----
  const coreFriendGroup = (secondDegree?.nodes ?? [])
    .slice(0, 15)
    .map((node) => ({
      username: node.username,
      fullName: node.fullName,
      profilePicUrl: node.profilePicUrl,
      internalDegree: node.internalDegree,
    }));

  // ---- Tag relationships ----
  const youTag: TagRelation[] = [];
  const tagYou: TagRelation[] = [];
  const mutualTag: TagRelation[] = [];
  if (activity) {
    for (const signal of activity.taggedAccounts) {
      const base: TagRelation = {
        username: signal.account.username,
        fullName: signal.account.fullName,
        count: 0,
      };
      if (signal.taggedInOwnPosts > 0) {
        youTag.push({ ...base, count: signal.taggedInOwnPosts });
      }
      if (signal.taggedSubjectInTheirPosts > 0) {
        tagYou.push({ ...base, count: signal.taggedSubjectInTheirPosts });
      }
      if (signal.taggedInOwnPosts > 0 && signal.taggedSubjectInTheirPosts > 0) {
        mutualTag.push({
          ...base,
          count: signal.taggedInOwnPosts + signal.taggedSubjectInTheirPosts,
        });
      }
    }
  }
  youTag.sort((a, b) => b.count - a.count);
  tagYou.sort((a, b) => b.count - a.count);
  mutualTag.sort((a, b) => b.count - a.count);

  // ---- Places ----
  const places = (activity?.locations ?? []).slice(0, 8).map((visit) => ({
    name: visit.location.name,
    lastSeenIso: visit.lastSeenIso,
    visitCount: visit.visitCount,
  }));

  const biosAnalyzed = [...oneWayFollowing, ...mutuals].filter(
    (user) => (user.biography ?? "").trim().length > 0 || user.category,
  ).length;

  // ---- Narrative summary (third-person — any target can be searched) ----
  const summary: string[] = [];
  const followingCount = profile.followingCount || following.length;
  const followersCount = profile.followersCount || followers.length;
  const handle = `@${profile.username}`;

  const topInterestLabels = interests.slice(0, 4).map((topic) => topic.label);
  if (topInterestLabels.length > 0) {
    summary.push(
      `${handle}'s interests skew toward ${topInterestLabels.join(", ")} based on the accounts they follow.`,
    );
  } else {
    summary.push(
      `Not enough enriched bios yet to profile ${handle}'s interests — run \u201CLoad bios & rebuild map\u201D to pull categories from accounts they follow.`,
    );
  }

  summary.push(
    `${handle} follows ${followingCount.toLocaleString()} accounts and has ${followersCount.toLocaleString()} followers. ${mutuals.length.toLocaleString()} are mutuals (follow each other) — the strongest relationship circle.`,
  );

  if (oneWayFollowing.length > 0) {
    summary.push(
      `${oneWayFollowing.length.toLocaleString()} accounts ${handle} follows don't follow back — likely creators, brands, and public figures followed for content (${creatorsFollowed.toLocaleString()} look like creators/brands).`,
    );
  }

  if (youTag.length > 0 || tagYou.length > 0) {
    const tagBits: string[] = [];
    if (youTag[0]) {
      tagBits.push(`${handle} tags @${youTag[0].username} most`);
    }
    if (tagYou[0]) {
      tagBits.push(`@${tagYou[0].username} tags ${handle} most`);
    }
    summary.push(`Tag activity: ${tagBits.join("; ")}.`);
  }

  if (places.length > 0) {
    summary.push(
      `Recent geotagged places: ${places
        .slice(0, 3)
        .map((place) => place.name)
        .join(", ")}.`,
    );
  }

  if (coreFriendGroup.length > 0) {
    summary.push(
      `Tightest circle (mutuals who also follow each other): ${coreFriendGroup
        .slice(0, 5)
        .map((friend) => `@${friend.username}`)
        .join(", ")}.`,
    );
  }

  const headlineParts = [
    profile.fullName || `@${profile.username}`,
    topInterestLabels.length > 0
      ? `into ${topInterestLabels.slice(0, 3).join(", ")}`
      : null,
  ].filter(Boolean);
  const headline = headlineParts.join(" — ");

  return {
    headline,
    summary,
    interests,
    interestedIn,
    mutualHighlights,
    coreFriendGroup,
    tagRelationships: {
      youTag: youTag.slice(0, 15),
      tagYou: tagYou.slice(0, 15),
      mutualTag: mutualTag.slice(0, 15),
    },
    places,
    stats: {
      following: followingCount,
      followers: followersCount,
      mutuals: mutuals.length,
      interestedInCount: oneWayFollowing.length,
      creatorsFollowed,
      biosAnalyzed,
    },
  };
}
