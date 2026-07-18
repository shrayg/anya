import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintOathnetDiscordToRoblox } from "@/lib/csint";
import { extractDiscordIdsFromResults } from "@/lib/discord-extract";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import type { RobloxSearchResult } from "@/lib/roblox-search";
import { osintFailureResponse } from "@/lib/osint-search-guard";

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

    const results = Array.isArray(data.results) ? [...data.results] : [];
    // When a Discord snowflake resolves a Roblox account but the Roblox index
    // is empty, surface that account as the sole result.
    if (discordToRoblox && results.length === 0) {
      results.push(discordToRoblox);
    }

    const count =
      results.length === 0
        ? 0
        : Math.max(
            typeof data.count === "number" ? data.count : 0,
            results.length,
          );

    const response: RobloxSearchResult & {
      discordToRoblox?: Record<string, unknown>;
    } = {
      query,
      count,
      results,
      linkedDiscordIds,
      ...(discordToRoblox ? { discordToRoblox } : {}),
    };

    if (count === 0) {
      return NextResponse.json({
        ...response,
        message: "No results were found.",
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return osintFailureResponse(err instanceof Error ? err : new Error(String(message)));
  }
}
