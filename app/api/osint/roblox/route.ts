import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintOathnetDiscordToRoblox } from "@/lib/csint";
import { extractDiscordIdsFromResults } from "@/lib/discord-extract";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import type { RobloxSearchResult } from "@/lib/roblox-search";

const MAX_LINKED_PROFILES = 3;

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "roblox");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [data, discordToRoblox] = await Promise.all([
      fetchGodsEyeOnlySearch(query, "roblox"),
      isDiscordSnowflake(query)
        ? fetchCsintOathnetDiscordToRoblox(query)
        : Promise.resolve(null),
    ]);

    const linkedDiscordIds = extractDiscordIdsFromResults(data.results).slice(
      0,
      MAX_LINKED_PROFILES,
    );

    const response: RobloxSearchResult & {
      discordToRoblox?: Record<string, unknown> | null;
    } = {
      query,
      count: data.count,
      results: data.results,
      linkedDiscordIds,
      discordToRoblox,
    };

    if (data.count === 0 && !discordToRoblox) {
      return NextResponse.json({
        ...response,
        message: "No results were found.",
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}