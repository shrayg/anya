import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  normalizeInstagramUsername,
  searchInstagram,
} from "@/lib/instagram-search";

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

  const maxUsersParam = Number(req.nextUrl.searchParams.get("maxUsers") ?? "200");
  const listsParam = req.nextUrl.searchParams.get("lists");
  const lists =
    listsParam === "followers" || listsParam === "following"
      ? listsParam
      : "both";

  try {
    const data = await searchInstagram(query, {
      maxUsers: Number.isFinite(maxUsersParam) ? maxUsersParam : 200,
      lists,
    });

    const hasGraph =
      data.followers.length > 0 ||
      data.following.length > 0 ||
      Boolean(data.profile);
    const hasLeaks = data.leaks.count > 0;

    if (!hasGraph && !hasLeaks) {
      return NextResponse.json({
        ...data,
        message: "No Instagram graph or breach data was returned.",
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Instagram";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
