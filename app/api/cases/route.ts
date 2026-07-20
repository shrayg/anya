import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";

const caseInclude = {
  searches: {
    include: {
      searchHistory: {
        select: {
          id: true,
          query: true,
          searchType: true,
          resultData: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function GET() {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cases = await prisma.case.findMany({
      where: { userId: session.userId as number },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { searches: true } },
      },
    });

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("List cases error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const subjectName = String(body.subjectName || body.title || "").trim();
    const searchIds = Array.isArray(body.searchIds)
      ? body.searchIds.map((id: unknown) => Number(id)).filter(Number.isFinite)
      : [];

    if (!title) {
      return NextResponse.json(
        { error: "Case name is required" },
        { status: 400 },
      );
    }

    const userId = session.userId as number;

    const ownedSearches =
      searchIds.length > 0
        ? await prisma.searchHistory.findMany({
            where: { userId, id: { in: searchIds } },
            select: { id: true },
          })
        : [];

    const created = await prisma.case.create({
      data: {
        title,
        subjectName: subjectName || title,
        email: body.email ? String(body.email).trim() : null,
        phone: body.phone ? String(body.phone).trim() : null,
        username: body.username ? String(body.username).trim() : null,
        location: body.location ? String(body.location).trim() : null,
        notes: body.notes ? String(body.notes) : "",
        intelData: body.intelData ? String(body.intelData) : "",
        status: body.status ? String(body.status) : "active",
        userId,
        searches: {
          create: ownedSearches.map((search) => ({
            searchHistoryId: search.id,
          })),
        },
      },
      include: caseInclude,
    });

    return NextResponse.json({ case: created }, { status: 201 });
  } catch (error) {
    console.error("Create case error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
