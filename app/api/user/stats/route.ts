import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import {
  authorizeSearch,
  getUserPlanContext,
  invalidateUserPlanContext,
  recordSearchUsage,
} from "@/lib/plan-access";
import { detectBillingChannel } from "@/lib/plan-lifecycle";
import { maybeAutoFlagRiskySearch } from "@/lib/safety-flag-server";
import { prisma } from "@/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    const oneDayAgo = new Date(now.getTime() - DAY_MS);
    const oneWeekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const oneMonthAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [searches1w, searches1m, oldestInWindow, lastSubscription, user] =
      await Promise.all([
        prisma.searchHistory.count({
          where: { userId, createdAt: { gte: oneWeekAgo } },
        }),
        prisma.searchHistory.count({
          where: { userId, createdAt: { gte: oneMonthAgo } },
        }),
        prisma.searchHistory.findFirst({
          where: { userId, createdAt: { gte: oneDayAgo } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        prisma.payment.findFirst({
          where: {
            userId,
            type: "subscription",
            status: "completed",
          },
          orderBy: { createdAt: "desc" },
          select: {
            createdAt: true,
            interval: true,
            description: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            billingInterval: true,
            plan: true,
            planEndsAt: true,
            cancelAtPeriodEnd: true,
          },
        }),
      ]);

    const quotaRefreshAt =
      context.quota === Infinity || !oldestInWindow
        ? null
        : new Date(oldestInWindow.createdAt.getTime() + DAY_MS).toISOString();

    const billingInterval =
      ("billingInterval" in context && context.billingInterval) ||
      lastSubscription?.interval ||
      user?.billingInterval ||
      null;

    const planEndsAt =
      ("planEndsAt" in context && context.planEndsAt
        ? context.planEndsAt.toISOString()
        : null) ||
      user?.planEndsAt?.toISOString() ||
      null;

    const billingChannel =
      context.plan === "free"
        ? null
        : lastSubscription
          ? detectBillingChannel(lastSubscription.description)
          : "unknown";

    return NextResponse.json({
      plan: context.plan,
      balance: context.balance,
      quota: context.quota,
      intelxUsedToday: context.intelxUsedToday,
      quotaRefreshAt,
      planEndsAt,
      cancelAtPeriodEnd: Boolean(
        ("cancelAtPeriodEnd" in context && context.cancelAtPeriodEnd) ||
          user?.cancelAtPeriodEnd,
      ),
      billingChannel,
      billingInterval,
      usage: {
        last24h: context.searchesLast24h,
        last1w: searches1w,
        last1m: searches1m,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: access.reason ?? "Search not allowed." },
        { status: 403 },
      );
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

    return NextResponse.json({
      success: true,
      search: record,
      blurResults: access.blurResults,
    });
  } catch (error) {
    console.error("Error saving search history:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
