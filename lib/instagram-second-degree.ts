import "server-only";

import {
  fetchFriendshipListForSecondDegree,
  getInstagramSessionId,
  sleep,
  withInstagramRateLimitRetry,
  type InstagramUserSummary,
} from "@/lib/instagram-search";

export type SharedMutualNode = {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  /** How many of the subject's OTHER mutuals this person is connected to. */
  internalDegree: number;
  /** Usernames of the shared mutuals that connect to this person. */
  connectedTo: string[];
  closenessScore: number;
};

export type SharedMutualEdge = {
  source: string;
  target: string;
};

export type SecondDegreeGraph = {
  analyzedMutuals: number;
  nodes: SharedMutualNode[];
  edges: SharedMutualEdge[];
  clusters: Array<{ label: string; memberUsernames: string[]; size: number }>;
  warnings: string[];
};

/**
 * Second-degree analysis: for a budget of the subject's mutuals, pull who each
 * one follows and measure how tightly they are interconnected with the rest of
 * the mutual set. Densely-connected mutuals are the strongest "close friend"
 * signal — they form the subject's real-world friend cluster.
 *
 * This is rate-limit heavy, so it is opt-in and strictly budgeted.
 */
export async function computeSecondDegreeMutuals(
  mutuals: InstagramUserSummary[],
  options?: {
    maxMutualsToProbe?: number;
    perMutualFollowingCap?: number;
    delayMs?: number;
  },
): Promise<SecondDegreeGraph> {
  const warnings: string[] = [];

  if (!getInstagramSessionId()) {
    return {
      analyzedMutuals: 0,
      nodes: [],
      edges: [],
      clusters: [],
      warnings: ["Second-degree analysis requires an Instagram session."],
    };
  }
  if (mutuals.length < 3) {
    return {
      analyzedMutuals: 0,
      nodes: [],
      edges: [],
      clusters: [],
      warnings: ["Not enough mutuals for second-degree analysis."],
    };
  }

  const maxProbe = Math.min(options?.maxMutualsToProbe ?? 18, mutuals.length);
  const followingCap = options?.perMutualFollowingCap ?? 400;
  const delayMs = options?.delayMs ?? 600;

  const mutualIds = new Set(mutuals.map((user) => user.id));
  const idToUsername = new Map(
    mutuals.map((user) => [user.id, user.username] as const),
  );
  const targets = mutuals.slice(0, maxProbe);

  // For each probed mutual: the set of the subject's other mutuals they follow.
  const connections = new Map<string, Set<string>>();
  const edges: SharedMutualEdge[] = [];
  const edgeSeen = new Set<string>();
  let analyzed = 0;

  for (const mutual of targets) {
    try {
      const following = await withInstagramRateLimitRetry(() =>
        fetchFriendshipListForSecondDegree(mutual.id, followingCap),
      );

      analyzed += 1;

      const linked = new Set<string>();

      for (const account of following) {
        if (account.id === mutual.id) continue;
        if (mutualIds.has(account.id)) {
          linked.add(account.id);
          const key = [mutual.id, account.id].sort().join("|");

          if (!edgeSeen.has(key)) {
            edgeSeen.add(key);
            edges.push({ source: mutual.id, target: account.id });
          }
        }
      }
      connections.set(mutual.id, linked);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Second-degree probe stopped: ${error.message}`
          : "Second-degree probe failed.",
      );
      break;
    }
    await sleep(delayMs);
  }

  // Internal degree = how many other mutuals connect TO each node (in + out).
  const degree = new Map<string, Set<string>>();
  const bump = (a: string, b: string) => {
    const set = degree.get(a) ?? new Set<string>();

    set.add(b);
    degree.set(a, set);
  };

  for (const [mutualId, linkedSet] of connections) {
    for (const linkedId of linkedSet) {
      bump(mutualId, linkedId);
      bump(linkedId, mutualId);
    }
  }

  const nodes: SharedMutualNode[] = [...degree.entries()]
    .map(([id, linkedSet]) => {
      const user = mutuals.find((entry) => entry.id === id);
      const connectedTo = [...linkedSet]
        .map((linkedId) => idToUsername.get(linkedId))
        .filter((value): value is string => Boolean(value))
        .slice(0, 8);

      return {
        id,
        username: user?.username ?? id,
        fullName: user?.fullName ?? "",
        profilePicUrl: user?.profilePicUrl,
        internalDegree: linkedSet.size,
        connectedTo,
        closenessScore: linkedSet.size,
      } satisfies SharedMutualNode;
    })
    .filter((node) => node.internalDegree > 0)
    .sort((a, b) => b.internalDegree - a.internalDegree)
    .slice(0, 60);

  // Lightweight clustering: seed from the highest-degree node, group its direct
  // connections into a "core friend group".
  const clusters: SecondDegreeGraph["clusters"] = [];

  if (nodes.length > 0) {
    const core = nodes.slice(0, Math.min(12, nodes.length));

    clusters.push({
      label: "Core friend group (densely interconnected mutuals)",
      memberUsernames: core.map((node) => `@${node.username}`),
      size: core.length,
    });
  }

  if (analyzed < targets.length && warnings.length === 0) {
    warnings.push(
      `Second-degree analysis probed ${analyzed}/${targets.length} mutuals before stopping.`,
    );
  }

  return {
    analyzedMutuals: analyzed,
    nodes,
    edges,
    clusters,
    warnings,
  };
}
