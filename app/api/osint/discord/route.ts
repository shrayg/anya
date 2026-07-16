import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchBreachVipSanitized } from "@/lib/breachvip";
import {
  extractCsintDiscordLookupLeaks,
  fetchCsintDiscordLookup,
  fetchCsintDiscordOsint,
  fetchCsintOathnetDiscordToRoblox,
} from "@/lib/csint";
import { fetchDiscordProfile, type DiscordSearchResult } from "@/lib/discord-profile";
import {
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
  const access = await requireOsintAccess(req, "discord");
  if (access instanceof NextResponse) return access;

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
    const [
      profile,
      osintLeaks,
      godseyeLeaks,
      breachVipLeaks,
      csintOsint,
      csintLookup,
      robloxLink,
    ] = await Promise.all([
      fetchDiscordProfile(query),
      fetchOsintCatEndpoint("discord", query)
        .then((data) => filterDiscordResultsForId(query, data))
        .catch(() => ({ count: 0, results: [] as unknown[] })),
      fetchGodsEyeSearchSafe("discord", query)
        .then((data) => sanitizeGodsEyeSearch(data))
        .catch(() => ({ count: 0, results: [] as unknown[] })),
      fetchBreachVipSanitized(query, "discordid").catch(() => ({
        count: 0,
        results: [] as unknown[],
      })),
      fetchCsintDiscordOsint(query).catch(() => null),
      fetchCsintDiscordLookup(query).catch(() => null),
      fetchCsintOathnetDiscordToRoblox(query).catch(() => null),
    ]);

    const leaks = mergeSanitizedResponses(
      osintLeaks,
      godseyeLeaks,
      breachVipLeaks,
      csintOsint ?? { count: 0, results: [] },
      extractCsintDiscordLookupLeaks(csintLookup, query),
    );

    const response: DiscordSearchResult & {
      enrichment?: Record<string, unknown> | null;
      robloxLink?: Record<string, unknown>;
    } = {
      id: query,
      profile,
      leaks,
      enrichment: csintLookup,
      // Only attach when a real Roblox username/id/profile was resolved.
      ...(robloxLink ? { robloxLink } : {}),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve Discord profile";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
