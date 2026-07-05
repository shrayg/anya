import { NextRequest, NextResponse } from "next/server";

import { fetchDiscordProfile, type DiscordSearchResult } from "@/lib/discord-profile";
import {
  fetchGodsEyeFivem,
  fetchGodsEyeSearchSafe,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";
import {
  fetchOsintCatEndpoint,
  filterDiscordResultsForId,
  isDiscordSnowflake,
  mergeSanitizedResponses,
} from "@/lib/osintcat";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord snowflake ID (17–20 digits)." },
      { status: 400 },
    );
  }

  try {
    const [profile, osintLeaks, godseyeLeaks] = await Promise.all([
      fetchDiscordProfile(query),
      fetchOsintCatEndpoint("discord", query)
        .then((data) => filterDiscordResultsForId(query, data))
        .catch(() => ({ count: 0, results: [] as unknown[] })),
      fetchGodsEyeSearchSafe("discord", query)
        .then((data) => sanitizeGodsEyeSearch(data))
        .catch(() => ({ count: 0, results: [] as unknown[] })),
    ]);

    const leaks = mergeSanitizedResponses(osintLeaks, godseyeLeaks);

    const response: DiscordSearchResult = {
      id: query,
      profile,
      leaks,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve Discord profile";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
