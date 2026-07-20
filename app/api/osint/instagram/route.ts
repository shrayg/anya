import { NextRequest, NextResponse } from "next/server";

import { buildInstagramBubbleMap } from "@/lib/instagram-bubble-map";
import { buildInstagramPersona } from "@/lib/instagram-persona";
import {
  normalizeInstagramUsername,
  searchInstagram,
} from "@/lib/instagram-search";
import { requireOsintAccess } from "@/lib/osint-api-auth";

/** Large follower exports can take several minutes while paginating. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hard self-limit so we don't scrape thousands of relationships per search. */
const DEFAULT_MAX_USERS = 500;
const ABSOLUTE_MAX_USERS = 500;

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "instagram");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!normalizeInstagramUsername(query)) {
    return NextResponse.json(
      { error: "Enter a valid Instagram username or profile URL." },
      { status: 400 },
    );
  }

  const maxUsersParam = Number(
    req.nextUrl.searchParams.get("maxUsers") ?? String(DEFAULT_MAX_USERS),
  );
  const bioLimitParam = Number(
    req.nextUrl.searchParams.get("bioLimit") ?? "40",
  );
  const maxPostsParam = Number(
    req.nextUrl.searchParams.get("maxPosts") ?? "24",
  );
  const maxTaggedParam = Number(
    req.nextUrl.searchParams.get("maxTagged") ?? "24",
  );
  const commentPostsParam = Number(
    req.nextUrl.searchParams.get("commentPosts") ?? "8",
  );
  const listsParam = req.nextUrl.searchParams.get("lists");
  const lists =
    listsParam === "followers" || listsParam === "following"
      ? listsParam
      : "both";
  const enrichBios =
    req.nextUrl.searchParams.get("enrichBios") === "1" ||
    req.nextUrl.searchParams.get("enrichBios") === "true" ||
    req.nextUrl.searchParams.get("bubbleMap") === "1";
  const mutualFirst = req.nextUrl.searchParams.get("mutualFirst") !== "false";
  const includeActivity =
    req.nextUrl.searchParams.get("includeActivity") !== "false";
  const secondDegree =
    req.nextUrl.searchParams.get("secondDegree") === "1" ||
    req.nextUrl.searchParams.get("secondDegree") === "true";
  const secondDegreeBudgetParam = Number(
    req.nextUrl.searchParams.get("secondDegreeBudget") ?? "18",
  );

  try {
    const cappedMaxUsers = Math.min(
      Math.max(
        Number.isFinite(maxUsersParam) ? maxUsersParam : DEFAULT_MAX_USERS,
        1,
      ),
      ABSOLUTE_MAX_USERS,
    );

    const data = await searchInstagram(query, {
      maxUsers: cappedMaxUsers,
      lists,
      enrichBios,
      bioLimit: Number.isFinite(bioLimitParam) ? bioLimitParam : 40,
      mutualFirst,
      includeActivity,
      maxPosts: Number.isFinite(maxPostsParam) ? maxPostsParam : 24,
      maxTagged: Number.isFinite(maxTaggedParam) ? maxTaggedParam : 24,
      commentPosts: Number.isFinite(commentPostsParam) ? commentPostsParam : 8,
      secondDegree,
      secondDegreeBudget: Number.isFinite(secondDegreeBudgetParam)
        ? secondDegreeBudgetParam
        : 18,
    });

    const bubbleMap =
      data.profile &&
      buildInstagramBubbleMap({
        profile: data.profile,
        followers: data.followers,
        following: data.following,
        mutuals: data.mutuals,
        activity: data.activity,
      });

    const persona =
      data.profile &&
      buildInstagramPersona({
        profile: data.profile,
        followers: data.followers,
        following: data.following,
        mutuals: data.mutuals,
        activity: data.activity,
        secondDegree: data.secondDegree,
      });

    const response = {
      ...data,
      bubbleMap,
      persona,
    };

    const hasGraph =
      data.followers.length > 0 ||
      data.following.length > 0 ||
      Boolean(data.profile) ||
      Boolean(data.activity?.postsAnalyzed) ||
      Boolean(data.activity?.taggedPostsAnalyzed);
    const hasLeaks = data.leaks.count > 0;

    if (!hasGraph && !hasLeaks) {
      return NextResponse.json({
        ...response,
        message: "No Instagram graph or breach data was returned.",
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Instagram";
    const status = /rate.?limit|429|try again/i.test(message) ? 429 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
