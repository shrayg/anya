import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { authorizeSearch, getUserPlanContext, invalidateUserPlanContext, recordSearchUsage } from "@/lib/plan-access";
import { maybeAutoFlagRiskySearch } from "@/lib/safety-flag-server";
import { prisma } from "@/prisma/client";

export async function GET() {
  try {
    const session = await getSessionCookie();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId as number;
    const context = await getUserPlanContext(userId);

    if (!context) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [searches1w, searches1m] = await Promise.all([
      prisma.searchHistory.count({ where: { userId, createdAt: { gte: oneWeekAgo } } }),
      prisma.searchHistory.count({ where: { userId, createdAt: { gte: oneMonthAgo } } }),
    ]);

    return NextResponse.json({
      plan: context.plan,
      balance: context.balance,
      quota: context.quota,
      intelxUsedToday: context.intelxUsedToday,
      usage: {
        last24h: context.searchesLast24h,
        last1w: searches1w,
        last1m: searches1m,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionCookie();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId as number;
    const { query, type, resultData, moduleSlug } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const slug = String(moduleSlug ?? type ?? "search");
    const access = await authorizeSearch({ userId, moduleSlug: slug });

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason ?? "Search not allowed." }, { status: 403 });
    }

    const searchType = String(type ?? slug);
    const record = await prisma.searchHistory.create({
      data: {
        userId,
        query: `[${searchType}] ${query}`,
        searchType,
        resultData: resultData ? String(resultData) : "",
      },
    });

    // Silent auto-flag for concerning queries (esp. underage risk).
    void maybeAutoFlagRiskySearch({
      userId,
      query: String(query),
      moduleSlug: slug,
      searchType,
      searchHistoryId: record.id,
    }).catch((error) => {
      console.error("Auto safety flag (stats) failed:", error);
    });

    if (access.balanceCost) {
      await recordSearchUsage(userId, slug, access.balanceCost);
    }

    invalidateUserPlanContext(userId);

    return NextResponse.json({ success: true, search: record, blurResults: access.blurResults });
  } catch (error) {
    console.error("Error saving search history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
