import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchBreachVipSanitized } from "@/lib/breachvip";
import { fetchCordCatQuery } from "@/lib/cordcat";
import {
  extractCsintDiscordLookupLeaks,
  fetchCsintDiscordLookup,
  fetchCsintDiscordOsint,
  fetchCsintOathnetDiscordToRoblox,
} from "@/lib/csint";
import {
  parseDiscordDsaFromStatements,
  fetchPublicDsaSanctions,
} from "@/lib/discord-dsa";
import {
  fetchDiscordProfile,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { fetchFivemIntel } from "@/lib/fivem-search";
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

function cordCatFivemRecords(query: Awaited<ReturnType<typeof fetchCordCatQuery>>) {
  const results = query?.fivem?.data?.results;
  return Array.isArray(results) ? results : [];
}

async function resolveDsa(discordId: string, cordStatements: unknown) {
  const fromCord = parseDiscordDsaFromStatements(cordStatements);
  if (fromCord.length > 0) {
    return { count: fromCord.length, sanctions: fromCord };
  }

  const fromPublic = await fetchPublicDsaSanctions(discordId);
  return { count: fromPublic.length, sanctions: fromPublic };
}

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
      fivemIntel,
      cordQuery,
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
      fetchFivemIntel(query).catch(() => ({
        searchData: null,
        records: [] as unknown[],
      })),
      fetchCordCatQuery(query).catch(() => null),
    ]);

    const dsa = await resolveDsa(query, cordQuery?.statements).catch(() => ({
      count: 0,
      sanctions: [],
    }));

    const leaks = mergeSanitizedResponses(
      osintLeaks,
      godseyeLeaks,
      breachVipLeaks,
      csintOsint ?? { count: 0, results: [] },
      extractCsintDiscordLookupLeaks(csintLookup, query),
    );

    const fivemFromGodsEye = fivemIntel.records ?? [];
    const fivemFromCord = cordCatFivemRecords(cordQuery);
    const fivemMerged =
      fivemFromGodsEye.length > 0 ? fivemFromGodsEye : fivemFromCord;
    const cordFivemTotal =
      typeof cordQuery?.fivem?.data?.total === "number"
        ? cordQuery.fivem.data.total
        : fivemFromCord.length;

    const response: DiscordSearchResult & {
      enrichment?: Record<string, unknown> | null;
      robloxLink?: Record<string, unknown>;
    } = {
      id: query,
      profile,
      leaks,
      fivem: {
        count: Math.max(fivemMerged.length, cordFivemTotal),
        accounts: fivemMerged,
        bans: [],
      },
      dsa,
      enrichment: csintLookup,
      ...(robloxLink ? { robloxLink } : {}),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve Discord profile";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
