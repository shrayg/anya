import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { authorizeSearch } from "@/lib/plan-access";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionCookie();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { moduleSlug } = (await req.json()) as { moduleSlug?: string };

    if (!moduleSlug) {
      return NextResponse.json(
        { error: "Missing moduleSlug" },
        { status: 400 },
      );
    }

    const access = await authorizeSearch({
      userId: session.userId as number,
      moduleSlug,
    });

    return NextResponse.json(access);
  } catch (error) {
    console.error("Search authorize error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
