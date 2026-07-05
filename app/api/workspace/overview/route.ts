import { NextResponse } from "next/server";

import { prisma } from "@/prisma/client";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const auth = await requireWorkspaceAdmin();
    if (auth.error) return auth.error;

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      frozenUsers,
      bannedUsers,
      investigateUsers,
      searches24h,
      searches7d,
      searches30d,
      signups24h,
      signups7d,
      revenue30d,
      payments,
      recentSearches,
      signupsRecent,
      searchRowsRecent,
      statusCounts,
      searchTypeGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { accountStatus: "active" } }),
      prisma.user.count({ where: { accountStatus: "frozen" } }),
      prisma.user.count({ where: { accountStatus: "banned" } }),
      prisma.user.count({ where: { accountStatus: "investigate" } }),
      prisma.searchHistory.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.searchHistory.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.searchHistory.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: monthAgo },
          status: "completed",
        },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.searchHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          query: true,
          searchType: true,
          createdAt: true,
          user: { select: { username: true } },
        },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true },
      }),
      prisma.searchHistory.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true, searchType: true },
      }),
      prisma.user.groupBy({
        by: ["accountStatus"],
        _count: { id: true },
      }),
      prisma.searchHistory.groupBy({
        by: ["searchType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
    ]);

    const dailyKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfDay(now));
      date.setDate(date.getDate() - (6 - index));
      return formatDayKey(date);
    });

    const signupMap = new Map(dailyKeys.map((key) => [key, 0]));
    const searchMap = new Map(dailyKeys.map((key) => [key, 0]));

    for (const signup of signupsRecent) {
      const key = formatDayKey(new Date(signup.createdAt));
      if (signupMap.has(key)) {
        signupMap.set(key, (signupMap.get(key) ?? 0) + 1);
      }
    }

    for (const search of searchRowsRecent) {
      const key = formatDayKey(new Date(search.createdAt));
      if (searchMap.has(key)) {
        searchMap.set(key, (searchMap.get(key) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      summary: {
        totalUsers,
        activeUsers,
        frozenUsers,
        bannedUsers,
        investigateUsers,
        searches24h,
        searches7d,
        searches30d,
        signups24h,
        signups7d,
        revenue30d: revenue30d._sum.amount ?? 0,
      },
      statusCounts,
      trafficByType: searchTypeGroups.map((entry) => ({
        type: entry.searchType,
        count: entry._count.id,
      })),
      trafficByDay: dailyKeys.map((date) => ({
        date,
        signups: signupMap.get(date) ?? 0,
        searches: searchMap.get(date) ?? 0,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        type: payment.type,
        plan: payment.plan,
        status: payment.status,
        description: payment.description,
        createdAt: payment.createdAt,
        username: payment.user.username,
      })),
      recentActivity: recentSearches.map((entry) => ({
        id: entry.id,
        query: entry.query,
        searchType: entry.searchType,
        createdAt: entry.createdAt,
        username: entry.user.username,
      })),
    });
  } catch (error) {
    console.error("Error fetching workspace overview:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
