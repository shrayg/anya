import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchDiscordProfile } from "@/lib/discord-profile";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { osintFailureResponse } from "@/lib/osint-search-guard";

const MAX_PROFILES = 3;

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "discord/profile");
  if (access instanceof NextResponse) return access;

  const idsParam = req.nextUrl.searchParams.get("ids")?.trim();
  const singleId = req.nextUrl.searchParams.get("id")?.trim();
  const raw = idsParam ?? singleId ?? "";

  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => isDiscordSnowflake(value))
    .slice(0, MAX_PROFILES);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing valid Discord ID(s)" }, { status: 400 });
  }

  try {
    const profiles = await Promise.all(
      ids.map(async (id) => ({
        id,
        profile: await fetchDiscordProfile(id),
      })),
    );

    return NextResponse.json({ profiles });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve Discord profile(s)";

    return osintFailureResponse(err instanceof Error ? err : new Error(String(message)));
  }
}
