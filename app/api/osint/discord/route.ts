import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchBreachVipSanitized } from "@/lib/breachvip";
import {
  fetchBreachHubDiscord,
  fetchBreachHubRaw,
  fetchBreachHubSpecialty,
} from "@/lib/breachhub";
import { fetchCordCatQuery } from "@/lib/cordcat";
import {
  extractCsintDiscordLookupLeaks,
  fetchCsintDiscordLookup,
  fetchCsintDiscordOsint,
} from "@/lib/csint";
import { fetchOathnetDiscordToRoblox } from "@/lib/gateway-fallback";
import { mergeDiscordOsintEnrichment } from "@/lib/discord-enrichment";
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
import { fetchGodsEyeSearchSafe, sanitizeGodsEyeSearch } from "@/lib/godseye";
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

function cordCatFivemRecords(
  query: Awaited<ReturnType<typeof fetchCordCatQuery>>,
) {
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

/** OsintCat stalker — mutual guilds live here, not on /api/discord leaks. */
async function fetchOsintCatDiscordStalker(
  discordId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await fetchOsintCatEndpoint("discord-stalker", discordId);

    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "discord");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 },
    );
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
      breachHubLeaks,
      breachHubFivem,
      osintCatStalker,
      bhStalker,
      bhLookup,
      bhSeeknowUser,
      bhUserInfo,
      bhUsernameHistory,
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
        fetchOathnetDiscordToRoblox(query).catch(() => null),
        fetchFivemIntel(query).catch(() => ({
          searchData: null,
          records: [] as unknown[],
        })),
        fetchCordCatQuery(query).catch(() => null),
        fetchBreachHubDiscord(query).catch(() => null),
        fetchBreachHubSpecialty("fivem", query).catch(() => null),
        fetchOsintCatDiscordStalker(query),
        fetchBreachHubRaw("discord-stalker", { query }).catch(() => null),
        fetchBreachHubRaw("discord-lookup", { query }).catch(() => null),
        fetchBreachHubRaw("seeknow-discord-user", {
          discord_id: query,
        }).catch(() => null),
        fetchBreachHubRaw("oathnet-discord-userinfo", {
          discord_id: query,
        }).catch(() => null),
        fetchBreachHubRaw("oathnet-discord-history", {
          discord_id: query,
        }).catch(() => null),
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
      breachHubLeaks ?? { count: 0, results: [] },
    );

    const fivemFromGodsEye = fivemIntel.records ?? [];
    const fivemFromCord = cordCatFivemRecords(cordQuery);
    const fivemFromBh =
      breachHubFivem && Array.isArray(breachHubFivem.results)
        ? breachHubFivem.results
        : [];
    const fivemMerged =
      fivemFromGodsEye.length > 0
        ? fivemFromGodsEye
        : fivemFromBh.length > 0
          ? fivemFromBh
          : fivemFromCord;
    const cordFivemTotal =
      typeof cordQuery?.fivem?.data?.total === "number"
        ? cordQuery.fivem.data.total
        : fivemFromCord.length;

    const osintEnrichment = mergeDiscordOsintEnrichment(
      osintCatStalker,
      bhStalker,
      bhLookup,
      bhSeeknowUser,
      bhUserInfo,
      bhUsernameHistory,
      cordQuery,
      csintLookup,
      csintOsint,
      ...(breachHubLeaks?.results ?? []),
    );

    const hasContacts = Boolean(
      osintEnrichment.contacts.email ||
        osintEnrichment.contacts.phone ||
        osintEnrichment.contacts.ip,
    );

    const response: DiscordSearchResult = {
      id: query,
      profile,
      leaks,
      fivem: {
        count: Math.max(
          fivemMerged.length,
          cordFivemTotal,
          breachHubFivem?.count ?? 0,
        ),
        accounts: fivemMerged,
        bans: [],
      },
      dsa,
      enrichment: csintLookup,
      robloxLink: normalizeRobloxLink(robloxLink, query),
      guilds: {
        count: osintEnrichment.mutualServersCount,
        items: osintEnrichment.guilds,
      },
      connections:
        osintEnrichment.connections.length > 0
          ? osintEnrichment.connections
          : undefined,
      contacts: hasContacts ? osintEnrichment.contacts : undefined,
      usernameHistory:
        osintEnrichment.usernameHistory.length > 0
          ? osintEnrichment.usernameHistory
          : undefined,
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
        guilds: { count: 0, items: [] },
        connections: [],
        contacts: null,
        usernameHistory: [],
      },
      fallbackMessage: "Failed to resolve Discord profile",
    });
  }
}
