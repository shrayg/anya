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
  type DiscordRobloxLink,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { fetchFivemIntel } from "@/lib/fivem-search";
import {
  fetchGodsEyeSearchSafe,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
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

function cordCatBreachLeaks(
  query: Awaited<ReturnType<typeof fetchCordCatQuery>>,
): { count: number; results: unknown[] } {
  const breach = query?.breach;
  if (!breach) return { count: 0, results: [] };

  const data = breach.data;
  if (Array.isArray(data) && data.length > 0) {
    return { count: data.length, results: data };
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).results;
    if (Array.isArray(nested) && nested.length > 0) {
      return { count: nested.length, results: nested };
    }
  }

  return { count: 0, results: [] };
}

function normalizeRobloxLink(
  link: Record<string, unknown> | null,
  discordId: string,
): DiscordSearchResult["robloxLink"] {
  if (!link) return null;

  const username =
    typeof link.username === "string" && link.username.trim()
      ? link.username.trim()
      : undefined;
  const userId =
    typeof link.userId === "string" && link.userId.trim()
      ? link.userId.trim()
      : typeof link.user_id === "string" && link.user_id.trim()
        ? link.user_id.trim()
        : undefined;
  const profileUrl =
    typeof link.profileUrl === "string" && link.profileUrl.trim()
      ? link.profileUrl.trim()
      : typeof link.profile_url === "string" && link.profile_url.trim()
        ? link.profile_url.trim()
        : undefined;

  if (!username && !userId && !profileUrl) return null;

  return {
    ...(username ? { username } : {}),
    ...(userId ? { userId } : {}),
    ...(profileUrl ? { profileUrl } : {}),
    discord_id: discordId,
  };
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
      { error: "Enter a valid Discord ID (17–20 digits)." },
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
    ] = await withDeadline(
      Promise.all([
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
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

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
      cordCatBreachLeaks(cordQuery),
    );

    const fivemFromGodsEye = fivemIntel.records ?? [];
    const fivemFromCord = cordCatFivemRecords(cordQuery);
    const fivemMerged =
      fivemFromGodsEye.length > 0 ? fivemFromGodsEye : fivemFromCord;
    const cordFivemTotal =
      typeof cordQuery?.fivem?.data?.total === "number"
        ? cordQuery.fivem.data.total
        : fivemFromCord.length;

    const response: DiscordSearchResult = {
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
      robloxLink: normalizeRobloxLink(robloxLink, query),
    };

    return NextResponse.json(response);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        id: query,
        profile: null,
        leaks: { count: 0, results: [] },
        fivem: { count: 0, accounts: [], bans: [] },
        dsa: { count: 0, sanctions: [] },
        robloxLink: null as DiscordRobloxLink | null,
        enrichment: null,
      },
      fallbackMessage: "Failed to resolve Discord profile",
    });
  }
}
