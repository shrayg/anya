import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";

export async function GET() {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searches = await prisma.searchHistory.findMany({
      where: { userId: session.userId as number },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        query: true,
        searchType: true,
        resultData: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ searches });
  } catch (error) {
    console.error("List searches error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
