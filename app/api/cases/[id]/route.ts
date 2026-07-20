import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

async function getOwnedCase(id: string, userId: number, withSearches = false) {
  const caseId = Number(id);

  if (!Number.isFinite(caseId)) {
    return null;
  }

  return prisma.case.findFirst({
    where: { id: caseId, userId },
    include: withSearches ? caseInclude : undefined,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const record = await getOwnedCase(id, session.userId as number, true);

    if (!record) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    return NextResponse.json({ case: record });
  } catch (error) {
    console.error("Get case error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await getOwnedCase(id, session.userId as number);

    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const body = await request.json();
    const searchIds = Array.isArray(body.searchIds)
      ? body.searchIds
          .map((value: unknown) => Number(value))
          .filter(Number.isFinite)
      : null;

    if (searchIds) {
      const ownedSearches = await prisma.searchHistory.findMany({
        where: {
          userId: session.userId as number,
          id: { in: searchIds },
        },
        select: { id: true },
      });

      await prisma.caseSearch.deleteMany({ where: { caseId: existing.id } });
      if (ownedSearches.length > 0) {
        await prisma.caseSearch.createMany({
          data: ownedSearches.map((search) => ({
            caseId: existing.id,
            searchHistoryId: search.id,
          })),
        });
      }
    }

    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        subjectName:
          body.subjectName !== undefined
            ? String(body.subjectName).trim()
            : undefined,
        email:
          body.email !== undefined
            ? String(body.email).trim() || null
            : undefined,
        phone:
          body.phone !== undefined
            ? String(body.phone).trim() || null
            : undefined,
        username:
          body.username !== undefined
            ? String(body.username).trim() || null
            : undefined,
        location:
          body.location !== undefined
            ? String(body.location).trim() || null
            : undefined,
        notes: body.notes !== undefined ? String(body.notes) : undefined,
        intelData:
          body.intelData !== undefined ? String(body.intelData) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
      },
      include: caseInclude,
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    console.error("Update case error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await getOwnedCase(id, session.userId as number);

    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    await prisma.case.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete case error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
