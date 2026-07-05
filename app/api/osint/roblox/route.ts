import { NextRequest, NextResponse } from "next/server";

import { extractDiscordIdsFromResults } from "@/lib/discord-extract";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import type { RobloxSearchResult } from "@/lib/roblox-search";

const MAX_LINKED_PROFILES = 3;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const data = await fetchGodsEyeOnlySearch(query, "roblox");
    const linkedDiscordIds = extractDiscordIdsFromResults(data.results).slice(
      0,
      MAX_LINKED_PROFILES,
    );

    const response: RobloxSearchResult = {
      query,
      count: data.count,
      results: data.results,
      linkedDiscordIds,
    };

    if (data.count === 0) {
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
