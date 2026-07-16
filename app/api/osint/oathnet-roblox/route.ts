import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchCsintOathnetDiscordToRoblox,
  isCsintEnabled,
} from "@/lib/csint";
import { isDiscordSnowflake } from "@/lib/osintcat";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "oathnet-roblox");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord snowflake ID (17–20 digits)." },
      { status: 400 },
    );
  }

  if (!isCsintEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 502 },
    );
  }

  try {
    const data = await fetchCsintOathnetDiscordToRoblox(query);

    if (!data) {
      return NextResponse.json({
        discord_id: query,
        message: "No linked Roblox account was found.",
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
